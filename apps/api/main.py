import asyncio
import os
import uuid
from dataclasses import dataclass
from typing import Optional
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path

# Load environment variables from .env file
from dotenv import load_dotenv
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

from transcribe import transcribe_audio, download_audio
from transcription_process import TranscriptionProcess, process_manager
from ai_service import AIService, decrypt_api_key
from ai_routes import router as ai_router

# Configuration
TEMP_AUDIO_DIR = os.getenv("TEMP_AUDIO_DIR", "/tmp/podcast-transcribe")
os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)

TRANSCRIPTION_TIMEOUT_HOURS = 4

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# In-memory storage for transcription tasks
# In production, use Redis or database
transcription_tasks = {}


@dataclass
class QueueItem:
    task_id: str
    episode_id: str
    audio_url: str
    user_id: Optional[str]
    created_at: datetime
    started_at: Optional[datetime] = None


# Global queue state
transcription_queue: asyncio.Queue[QueueItem] = asyncio.Queue()
current_processing: Optional[QueueItem] = None
worker_task: Optional[asyncio.Task] = None

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
    segments: Optional[list] = None
    language: Optional[str] = None
    error: Optional[str] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Starting server. Temp directory: {TEMP_AUDIO_DIR}")
    await mark_stalled_transcriptions()

    global worker_task
    if worker_task is None or worker_task.done():
        worker_task = asyncio.create_task(transcription_worker())

    yield

    # Shutdown
    print("Shutting down server")
    if worker_task and not worker_task.done():
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass
    # Clean up all transcription processes
    print("Cleaning up transcription processes...")
    process_manager.cleanup_all()


app = FastAPI(
    title="Podcast Transcription API",
    description="API for transcribing podcast episodes using Whisper",
    version="1.0.0",
    lifespan=lifespan
)

# Include AI routes
app.include_router(ai_router)

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
async def create_transcription(request: TranscriptionRequest):
    """Create a new transcription task - add to queue"""
    global worker_task

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

    queue_item = QueueItem(
        task_id=task_id,
        episode_id=request.episode_id,
        audio_url=request.audio_url,
        user_id=request.user_id,
        created_at=datetime.now()
    )
    await transcription_queue.put(queue_item)

    # Ensure worker coroutine is running
    if worker_task is None or worker_task.done():
        worker_task = asyncio.create_task(transcription_worker())

    return TranscriptionResponse(
        task_id=task_id,
        status="pending",
        message="Transcription queued"
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
        segments=task.get("segments"),
        language=task.get("language"),
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
                "segments": task.get("segments"),
                "language": task.get("language"),
                "error": task.get("error")
            })

            # Close connection if task is completed, failed, or cancelled
            if task.get("status") in ["completed", "failed", "cancelled"]:
                await websocket.close()
                break

            await asyncio.sleep(1)
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for task {task_id}")


async def update_transcription_in_db(
    episode_id: str,
    status: str,
    text: str | None = None,
    segments: list | None = None,
    language: str | None = None,
    error: str | None = None
):
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

        if segments is not None:
            update_data["segments"] = segments

        if language is not None:
            update_data["language"] = language

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


async def handle_timeout(task_id: str):
    """Handle transcription timeout"""
    if task_id in transcription_tasks:
        task = transcription_tasks[task_id]
        task["status"] = "failed"
        task["error"] = f"Transcription timeout after {TRANSCRIPTION_TIMEOUT_HOURS} hours"
        await update_transcription_in_db(
            task.get("episode_id"),
            "failed",
            error=f"Timeout after {TRANSCRIPTION_TIMEOUT_HOURS} hours"
        )


@app.post("/transcribe/{task_id}/cancel")
async def cancel_transcription(task_id: str):
    """Cancel a pending or processing transcription task"""
    if task_id not in transcription_tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    task = transcription_tasks[task_id]
    current_status = task.get("status")

    # Can only cancel pending or processing tasks
    if current_status not in ["pending", "processing"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel transcription with status '{current_status}'"
        )

    # Try to cancel the process if it's running
    cancelled = process_manager.cancel_process(task_id, timeout=5.0)

    # Update task status
    task["status"] = "cancelled"
    task["progress"] = 0.0

    # Update database
    await update_transcription_in_db(
        task.get("episode_id"),
        "cancelled",
        error="Transcription cancelled by user"
    )

    # Clean up the process from tracking
    process_manager.remove_process(task_id)

    return {
        "task_id": task_id,
        "status": "cancelled",
        "message": "Transcription cancelled successfully"
    }


async def transcription_worker():
    """Queue worker coroutine - serial processing with process-based transcription"""
    global current_processing
    while True:
        try:
            item = await transcription_queue.get()

            # Check if task was cancelled while in queue
            if item.task_id in transcription_tasks:
                task = transcription_tasks[item.task_id]
                if task.get("status") == "cancelled":
                    transcription_queue.task_done()
                    continue

            current_processing = item
            item.started_at = datetime.now()

            if item.task_id in transcription_tasks:
                transcription_tasks[item.task_id]["status"] = "processing"
                transcription_tasks[item.task_id]["progress"] = 0.1

            try:
                await asyncio.wait_for(
                    process_transcription(item.task_id, item.audio_url),
                    timeout=TRANSCRIPTION_TIMEOUT_HOURS * 3600
                )
            except asyncio.TimeoutError:
                await handle_timeout(item.task_id)

            current_processing = None
            transcription_queue.task_done()

            # Clean up finished processes periodically
            process_manager.cleanup_finished()
        except Exception as e:
            print(f"Worker error: {e}")
            await asyncio.sleep(1)


async def mark_stalled_transcriptions():
    """Mark database transcriptions that have timed out"""
    try:
        supabase = get_supabase()
        if not supabase:
            return

        cutoff_time = (datetime.now() - timedelta(hours=4)).isoformat()

        result = supabase.table("pc_transcriptions") \
            .update({
                "status": "failed",
                "error_message": "Transcription timeout",
                "completed_at": datetime.now().isoformat()
            }) \
            .eq("status", "processing") \
            .lt("created_at", cutoff_time) \
            .execute()

        if result.data:
            print(f"Marked {len(result.data)} stalled transcriptions as failed")
    except Exception as e:
        print(f"Failed to mark stalled transcriptions: {e}")


async def on_transcription_completed(
    transcription_id: str,
    transcription_text: str,
    user_id: Optional[str]
):
    """转录完成后的回调，自动生成 AI 总结"""
    if not user_id:
        return

    try:
        supabase = get_supabase()
        if not supabase:
            return

        # 1. 从 Supabase 获取用户设置
        result = supabase.table("pc_user_settings") \
            .select("*") \
            .eq("user_id", user_id) \
            .maybe_single() \
            .execute()

        if not result.data:
            return  # 用户未配置 AI 设置

        settings = result.data

        # 2. 检查是否开启自动总结且配置完整
        if not settings.get("enable_auto_summary", True):
            return

        required_fields = ["llm_provider", "llm_api_key", "llm_model"]
        if not all(settings.get(f) for f in required_fields):
            return  # 配置不完整

        # 3. 解密 API Key
        api_key = decrypt_api_key(settings["llm_api_key"])

        # 4. 创建 AI 服务实例
        ai_service = AIService(
            provider=settings["llm_provider"],
            api_key=api_key,
            model=settings["llm_model"],
            base_url=settings.get("llm_base_url"),
            system_prompt=settings.get("system_prompt"),
            temperature=settings.get("temperature", 0.7)
        )

        # 5. 生成总结
        summary_content = ""
        user_prompt_template = settings.get("user_prompt_template", "")
        async for chunk in ai_service.generate_summary(
            transcription=transcription_text,
            user_prompt_template=user_prompt_template,
            stream=False  # Non-streaming for background task
        ):
            summary_content += chunk

        # 6. 将总结作为第一条 assistant 消息存入数据库
        supabase.table("pc_ai_chats").insert({
            "transcription_id": transcription_id,
            "user_id": user_id,
            "role": "assistant",
            "content": summary_content,
            "model": settings["llm_model"],
            "metadata": {
                "temperature": settings.get("temperature"),
                "prompt_template": user_prompt_template,
                "system_prompt": settings.get("system_prompt"),
                "auto_generated": True
            }
        }).execute()

        print(f"Auto-generated summary for transcription {transcription_id}")

    except Exception as e:
        print(f"Auto-summary generation failed: {e}")


async def get_transcription_id_by_episode(episode_id: str) -> Optional[str]:
    """Get the most recent transcription ID for an episode"""
    try:
        supabase = get_supabase()
        if not supabase:
            return None

        result = supabase.table("pc_transcriptions") \
            .select("id, user_id") \
            .eq("episode_id", episode_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .maybe_single() \
            .execute()

        if result.data:
            return result.data["id"], result.data.get("user_id")
        return None, None
    except Exception as e:
        print(f"Failed to get transcription ID: {e}")
        return None, None


async def process_transcription(task_id: str, audio_url: str):
    """Process transcription task using process-based approach for cancellation support"""
    task = transcription_tasks[task_id]
    temp_file = None
    episode_id = task.get("episode_id")
    user_id = task.get("user_id")

    try:
        # Check if task was cancelled before starting
        if task.get("status") == "cancelled":
            print(f"Task {task_id} was cancelled before processing started")
            return

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

        # Check again if cancelled after download
        if task.get("status") == "cancelled":
            print(f"Task {task_id} was cancelled after download")
            return

        # Create progress callback
        def on_progress(progress: float):
            # Scale progress from 0.3-0.9 range
            scaled_progress = 0.3 + (progress * 0.6)
            task["progress"] = scaled_progress

        # Get model from environment
        model = os.getenv("WHISPER_MODEL", "mlx-community/whisper-large-v3-turbo")

        # Create and start transcription process
        process = process_manager.create_process(
            task_id=task_id,
            audio_path=temp_file,
            model=model,
            on_progress=on_progress
        )

        process.start()

        # Poll until process completes or is cancelled
        while True:
            # Check if cancelled
            if task.get("status") == "cancelled":
                print(f"Task {task_id} cancellation detected during processing")
                process.cancel(timeout=5.0)
                process_manager.remove_process(task_id)
                return

            # Poll for updates
            completed = process.poll()

            if completed:
                result = process.get_result()
                break

            # Small sleep to avoid busy-waiting
            await asyncio.sleep(0.5)

        # Clean up process
        process_manager.remove_process(task_id)

        # Check result
        if result and result.success:
            task["text"] = result.text
            task["segments"] = result.segments or []
            task["language"] = result.language or "en"
            task["status"] = "completed"
            task["progress"] = 1.0

            # Update database
            if episode_id:
                await update_transcription_in_db(
                    episode_id,
                    "completed",
                    text=result.text,
                    segments=result.segments,
                    language=result.language
                )

                # Trigger auto-summary if user has settings configured
                transcription_id, db_user_id = await get_transcription_id_by_episode(episode_id)
                if transcription_id:
                    # Use user_id from task if available, otherwise from DB
                    summary_user_id = user_id or db_user_id
                    if summary_user_id:
                        asyncio.create_task(on_transcription_completed(
                            transcription_id=transcription_id,
                            transcription_text=result.text,
                            user_id=summary_user_id
                        ))
        else:
            error_msg = result.error if result else "Transcription failed"
            raise Exception(error_msg)

    except Exception as e:
        # Don't overwrite cancelled status
        if task.get("status") != "cancelled":
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
    # reload mode only for development, disabled in production (PM2)
    reload = os.getenv("PYTHON_ENV") == "development"
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=reload)
