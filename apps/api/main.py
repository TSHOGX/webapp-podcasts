import asyncio
import os
import uuid
from typing import Optional
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

# Load environment variables from .env file
from dotenv import load_dotenv
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

from transcribe import transcribe_audio, download_audio

# Configuration
TEMP_AUDIO_DIR = os.getenv("TEMP_AUDIO_DIR", "/tmp/podcast-transcribe")
os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# In-memory storage for transcription tasks
# In production, use Redis or database
transcription_tasks = {}

# Initialize Supabase client
def get_supabase() -> Client | None:
    """Get Supabase client if configured"""
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return None


class TranscriptionRequest(BaseModel):
    episode_id: str
    audio_url: str
    user_id: Optional[str] = None


class TranscriptionResponse(BaseModel):
    task_id: str
    status: str
    message: str


class TranscriptionStatus(BaseModel):
    task_id: str
    status: str
    progress: float
    text: Optional[str] = None
    error: Optional[str] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Starting server. Temp directory: {TEMP_AUDIO_DIR}")
    yield
    # Shutdown
    print("Shutting down server")


app = FastAPI(
    title="Podcast Transcription API",
    description="API for transcribing podcast episodes using Whisper",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/transcribe", response_model=TranscriptionResponse)
async def create_transcription(
    request: TranscriptionRequest,
    background_tasks: BackgroundTasks
):
    """Create a new transcription task"""
    task_id = str(uuid.uuid4())

    transcription_tasks[task_id] = {
        "task_id": task_id,
        "episode_id": request.episode_id,
        "user_id": request.user_id,
        "status": "pending",
        "progress": 0.0,
        "text": None,
        "error": None,
    }

    # Start transcription in background
    background_tasks.add_task(
        process_transcription,
        task_id,
        request.audio_url
    )

    return TranscriptionResponse(
        task_id=task_id,
        status="pending",
        message="Transcription task created successfully"
    )


@app.get("/transcribe/{task_id}", response_model=TranscriptionStatus)
async def get_transcription_status(task_id: str):
    """Get the status of a transcription task"""
    if task_id not in transcription_tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    task = transcription_tasks[task_id]
    return TranscriptionStatus(
        task_id=task["task_id"],
        status=task["status"],
        progress=task["progress"],
        text=task.get("text"),
        error=task.get("error")
    )


@app.websocket("/ws/transcribe/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    """WebSocket endpoint for real-time transcription updates"""
    await websocket.accept()

    if task_id not in transcription_tasks:
        await websocket.send_json({"error": "Task not found"})
        await websocket.close()
        return

    try:
        while True:
            task = transcription_tasks.get(task_id, {})
            await websocket.send_json({
                "task_id": task_id,
                "status": task.get("status"),
                "progress": task.get("progress", 0),
                "text": task.get("text"),
                "error": task.get("error")
            })

            # Close connection if task is completed or failed
            if task.get("status") in ["completed", "failed"]:
                await websocket.close()
                break

            await asyncio.sleep(1)
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for task {task_id}")


async def update_transcription_in_db(episode_id: str, status: str, text: str | None = None, error: str | None = None):
    """Update transcription status in Supabase database"""
    try:
        supabase = get_supabase()
        if not supabase:
            print("Supabase not configured, skipping database update")
            return

        # First, find the most recent transcription for this episode
        result = supabase.table("pc_transcriptions") \
            .select("id") \
            .eq("episode_id", episode_id) \
            .execute()

        if not result.data or len(result.data) == 0:
            print(f"No transcription found for episode_id={episode_id}")
            return

        # Get the most recent transcription id
        transcription_id = result.data[0]["id"]

        update_data = {
            "status": status,
            "completed_at": datetime.now().isoformat() if status in ["completed", "failed"] else None
        }

        if text is not None:
            update_data["text"] = text

        if error is not None:
            update_data["error_message"] = error

        # Update the transcription
        update_result = supabase.table("pc_transcriptions") \
            .update(update_data) \
            .eq("id", transcription_id) \
            .execute()

        print(f"Updated transcription in DB: episode_id={episode_id}, status={status}")
    except Exception as e:
        print(f"Failed to update transcription in DB: {e}")


async def process_transcription(task_id: str, audio_url: str):
    """Process transcription task"""
    task = transcription_tasks[task_id]
    temp_file = None
    episode_id = task.get("episode_id")

    try:
        # Update status to processing in DB
        if episode_id:
            await update_transcription_in_db(episode_id, "processing")

        # Update status to processing
        task["status"] = "processing"
        task["progress"] = 0.1

        # Download audio file
        task["progress"] = 0.2
        temp_file, download_error = await download_audio(audio_url, TEMP_AUDIO_DIR)

        if not temp_file:
            raise Exception(download_error or "Failed to download audio file")

        # Update progress
        task["progress"] = 0.3

        # Transcribe audio using mlx-whisper
        result = await transcribe_audio(temp_file, task)

        if result:
            task["text"] = result
            task["status"] = "completed"
            task["progress"] = 1.0

            # Update database
            if episode_id:
                await update_transcription_in_db(episode_id, "completed", text=result)
        else:
            raise Exception("Transcription failed")

    except Exception as e:
        task["status"] = "failed"
        task["error"] = str(e)
        print(f"Transcription error for task {task_id}: {e}")

        # Update database with error
        if episode_id:
            await update_transcription_in_db(episode_id, "failed", error=str(e))

    finally:
        # Clean up temp file
        if temp_file and os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except Exception as e:
                print(f"Error removing temp file: {e}")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "12890"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
