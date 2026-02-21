import os
import sys
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
import asyncio

import httpx

# Import mlx_whisper for direct transcription
import mlx_whisper


async def download_audio(audio_url: str, temp_dir: str) -> Tuple[Optional[str], Optional[str]]:
    """Download audio file from URL and save to temp directory.
    Returns: (temp_file_path, error_message)
    """
    if not audio_url:
        return None, "No audio URL provided"

    # Generate temp filename
    ext = ".mp3"  # Default extension
    if "." in audio_url.split("?")[0]:
        ext = Path(audio_url.split("?")[0]).suffix or ".mp3"

    temp_file = os.path.join(temp_dir, f"{asyncio.current_task().get_name() if asyncio.current_task() else 'audio'}{ext}")

    try:
        # Check if we should skip SSL verification (for development/testing)
        verify_ssl = os.getenv("VERIFY_SSL", "true").lower() == "true"

        async with httpx.AsyncClient(follow_redirects=True, timeout=300.0, verify=verify_ssl) as client:
            response = await client.get(audio_url)
            response.raise_for_status()

            with open(temp_file, "wb") as f:
                f.write(response.content)

        return temp_file, None
    except httpx.ConnectError as e:
        error_str = str(e)
        if "nodename nor servname provided" in error_str or "Name or service not known" in error_str:
            error_msg = f"DNS lookup failed: Cannot resolve audio server hostname. Please check your network connection or the audio URL."
        elif "Connection refused" in error_str:
            error_msg = f"Connection refused: Audio server rejected the connection."
        else:
            error_msg = f"Cannot connect to audio server: {e}"
        print(f"Download error: {error_msg}")
        return None, error_msg
    except httpx.HTTPStatusError as e:
        error_msg = f"Audio server returned error {e.response.status_code}"
        print(f"Download error: {error_msg}")
        return None, error_msg
    except Exception as e:
        error_str = str(e)
        if "CERTIFICATE_VERIFY_FAILED" in error_str or "SSL" in error_str:
            error_msg = f"SSL certificate verification failed: The audio server's SSL certificate could not be verified. You may need to update your system's SSL certificates or check if the server uses a self-signed certificate."
        else:
            error_msg = f"Failed to download audio: {type(e).__name__}: {e}"
        print(f"Download error: {error_msg}")
        return None, error_msg


async def transcribe_audio(audio_path: str, task: Dict[str, Any]) -> Optional[str]:
    """Transcribe audio file using mlx-whisper"""
    try:
        # Update progress
        task["progress"] = 0.4

        # Get model from environment or use default
        model = os.getenv("WHISPER_MODEL", "mlx-community/whisper-large-v3-turbo")

        task["progress"] = 0.5

        # Run mlx-whisper transcription in a thread pool to avoid blocking
        def transcribe():
            # Use mlx_whisper directly
            result = mlx_whisper.transcribe(audio_path, path_or_hf_repo=model)
            return result["text"]

        # Run the transcription in a thread pool
        loop = asyncio.get_event_loop()
        text = await loop.run_in_executor(None, transcribe)

        task["progress"] = 0.9

        if text:
            return text.strip()
        else:
            print("Transcription returned empty text")
            return None

    except asyncio.TimeoutError:
        print("Transcription timed out")
        return None
    except Exception as e:
        print(f"Transcription error: {e}")
        return None


async def transcribe_with_progress(audio_path: str, task: Dict[str, Any]) -> Optional[str]:
    """Transcribe with progress updates"""
    # This is a more advanced version that could stream progress
    # For now, just call the basic transcribe function
    return await transcribe_audio(audio_path, task)
