"""
Process-based transcription module for cancelable transcription tasks.

This module runs mlx_whisper transcription in a separate process, enabling
true cancellation via process termination.
"""

import multiprocessing
import os
import signal
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, Callable
from datetime import datetime
from pathlib import Path


@dataclass
class TranscriptionProgress:
    """Progress update from transcription process"""
    progress: float
    status: str
    text: Optional[str] = None
    segments: Optional[list] = None
    language: Optional[str] = None
    error: Optional[str] = None


@dataclass
class TranscriptionResult:
    """Final result from transcription process"""
    success: bool
    text: Optional[str] = None
    segments: Optional[list] = None
    language: Optional[str] = None
    error: Optional[str] = None


def _transcription_worker(
    audio_path: str,
    model: str,
    progress_queue: multiprocessing.Queue,
    result_queue: multiprocessing.Queue,
    task_id: str
):
    """
    Worker function that runs in a separate process.
    This function is pickled and sent to the child process, so it must be
    a top-level function with only serializable arguments.
    """
    try:
        # Import here to ensure it's loaded in the child process
        import mlx_whisper

        # Send initial progress
        progress_queue.put(TranscriptionProgress(
            progress=0.4,
            status="processing"
        ))

        # Run transcription
        result = mlx_whisper.transcribe(
            audio_path,
            path_or_hf_repo=model,
            word_timestamps=True
        )

        # Send final progress
        progress_queue.put(TranscriptionProgress(
            progress=0.9,
            status="processing"
        ))

        # Send result
        if result and result.get("text"):
            result_queue.put(TranscriptionResult(
                success=True,
                text=result["text"].strip(),
                segments=result.get("segments", []),
                language=result.get("language", "en")
            ))
        else:
            result_queue.put(TranscriptionResult(
                success=False,
                error="Transcription returned empty result"
            ))

    except Exception as e:
        result_queue.put(TranscriptionResult(
            success=False,
            error=f"Transcription error: {str(e)}"
        ))


class TranscriptionProcess:
    """
    Manages a transcription task in a separate process.

    Features:
    - Runs transcription in isolated process
    - Progress updates via multiprocessing.Queue
    - Three-tier cancellation (cooperative -> SIGTERM -> SIGKILL)
    - Automatic cleanup of zombie processes
    """

    def __init__(
        self,
        task_id: str,
        audio_path: str,
        model: str = "mlx-community/whisper-large-v3-turbo",
        on_progress: Optional[Callable[[float], None]] = None
    ):
        self.task_id = task_id
        self.audio_path = audio_path
        self.model = model
        self.on_progress = on_progress

        self.process: Optional[multiprocessing.Process] = None
        self.progress_queue: Optional[multiprocessing.Queue] = None
        self.result_queue: Optional[multiprocessing.Queue] = None
        self.started_at: Optional[datetime] = None
        self.ended_at: Optional[datetime] = None
        self.cancelled = False

        # Result storage
        self.result: Optional[TranscriptionResult] = None

    def start(self) -> bool:
        """Start the transcription process."""
        if self.process is not None and self.process.is_alive():
            return False

        self.cancelled = False
        self.started_at = datetime.now()

        # Create queues for communication
        self.progress_queue = multiprocessing.Queue()
        self.result_queue = multiprocessing.Queue()

        # Create and start the process
        self.process = multiprocessing.Process(
            target=_transcription_worker,
            args=(
                self.audio_path,
                self.model,
                self.progress_queue,
                self.result_queue,
                self.task_id
            ),
            name=f"transcription-{self.task_id}"
        )
        self.process.start()

        return True

    def is_alive(self) -> bool:
        """Check if the transcription process is still running."""
        return self.process is not None and self.process.is_alive()

    def poll(self) -> bool:
        """
        Poll for updates from the transcription process.
        Returns True if the process has completed (successfully or not).
        """
        if self.process is None:
            return True

        # Check for progress updates (non-blocking)
        if self.progress_queue is not None:
            while not self.progress_queue.empty():
                try:
                    progress = self.progress_queue.get_nowait()
                    if progress and self.on_progress:
                        self.on_progress(progress.progress)
                except:
                    break

        # Check for result (non-blocking)
        if self.result_queue is not None and not self.result_queue.empty():
            try:
                self.result = self.result_queue.get_nowait()
                self.ended_at = datetime.now()
            except:
                pass

        # Check if process has ended
        if not self.process.is_alive():
            # Get any remaining result
            if self.result_queue is not None and self.result is None:
                try:
                    self.result = self.result_queue.get_nowait()
                except:
                    pass

            # If no result and process died, it's an error
            if self.result is None:
                self.result = TranscriptionResult(
                    success=False,
                    error="Transcription process terminated unexpectedly"
                )

            self.ended_at = datetime.now()
            return True

        return False

    def cancel(self, timeout: float = 5.0) -> bool:
        """
        Cancel the transcription process.

        Uses three-tier cancellation:
        1. Set cancelled flag (cooperative)
        2. Send SIGTERM (graceful)
        3. Send SIGKILL (forceful)

        Args:
            timeout: Time to wait between SIGTERM and SIGKILL

        Returns:
            True if process was terminated, False otherwise
        """
        if self.process is None or not self.process.is_alive():
            self.cancelled = True
            return True

        self.cancelled = True

        # Tier 1: Try graceful termination
        self.process.terminate()  # SIGTERM

        # Wait for process to end
        self.process.join(timeout=timeout)

        if not self.process.is_alive():
            self.result = TranscriptionResult(
                success=False,
                error="Transcription cancelled by user"
            )
            self.ended_at = datetime.now()
            return True

        # Tier 2: Force kill
        try:
            os.kill(self.process.pid, signal.SIGKILL)
        except ProcessLookupError:
            # Process already died
            pass
        except Exception as e:
            print(f"Error killing process {self.process.pid}: {e}")

        self.process.join(timeout=1.0)

        if not self.process.is_alive():
            self.result = TranscriptionResult(
                success=False,
                error="Transcription cancelled by user (forced)"
            )
            self.ended_at = datetime.now()
            return True

        return False

    def cleanup(self):
        """Clean up resources (queues, etc.)."""
        if self.progress_queue is not None:
            # Drain the queue
            while not self.progress_queue.empty():
                try:
                    self.progress_queue.get_nowait()
                except:
                    break
            self.progress_queue.close()
            self.progress_queue = None

        if self.result_queue is not None:
            while not self.result_queue.empty():
                try:
                    self.result_queue.get_nowait()
                except:
                    break
            self.result_queue.close()
            self.result_queue = None

        if self.process is not None:
            if self.process.is_alive():
                try:
                    self.process.terminate()
                    self.process.join(timeout=1.0)
                except:
                    pass
            self.process.close()
            self.process = None

    def get_result(self) -> Optional[TranscriptionResult]:
        """Get the transcription result if available."""
        return self.result

    def get_runtime(self) -> Optional[float]:
        """Get the runtime in seconds, or None if not started."""
        if self.started_at is None:
            return None

        end_time = self.ended_at or datetime.now()
        return (end_time - self.started_at).total_seconds()


class ProcessManager:
    """
    Manages all active transcription processes.

    Provides centralized tracking and cleanup of transcription processes.
    """

    def __init__(self):
        self._processes: Dict[str, TranscriptionProcess] = {}
        self._lock = multiprocessing.Lock()

    def create_process(
        self,
        task_id: str,
        audio_path: str,
        model: str = "mlx-community/whisper-large-v3-turbo",
        on_progress: Optional[Callable[[float], None]] = None
    ) -> TranscriptionProcess:
        """Create and register a new transcription process."""
        with self._lock:
            # Clean up any existing process with this task_id
            if task_id in self._processes:
                old_process = self._processes[task_id]
                old_process.cancel(timeout=1.0)
                old_process.cleanup()

            process = TranscriptionProcess(
                task_id=task_id,
                audio_path=audio_path,
                model=model,
                on_progress=on_progress
            )
            self._processes[task_id] = process
            return process

    def get_process(self, task_id: str) -> Optional[TranscriptionProcess]:
        """Get a transcription process by task_id."""
        with self._lock:
            return self._processes.get(task_id)

    def remove_process(self, task_id: str) -> bool:
        """Remove a process from tracking and clean it up."""
        with self._lock:
            if task_id in self._processes:
                process = self._processes.pop(task_id)
                process.cleanup()
                return True
            return False

    def cancel_process(self, task_id: str, timeout: float = 5.0) -> bool:
        """Cancel a running transcription process."""
        with self._lock:
            process = self._processes.get(task_id)
            if process is None:
                return False

        return process.cancel(timeout=timeout)

    def cleanup_all(self):
        """Cancel and clean up all processes. Call on shutdown."""
        with self._lock:
            processes = list(self._processes.items())

        for task_id, process in processes:
            try:
                process.cancel(timeout=2.0)
                process.cleanup()
            except Exception as e:
                print(f"Error cleaning up process {task_id}: {e}")

        with self._lock:
            self._processes.clear()

    def cleanup_finished(self):
        """Remove completed/failed/cancelled processes from tracking."""
        with self._lock:
            to_remove = []
            for task_id, process in self._processes.items():
                if not process.is_alive() and process.result is not None:
                    to_remove.append(task_id)

            for task_id in to_remove:
                process = self._processes.pop(task_id)
                try:
                    process.cleanup()
                except Exception as e:
                    print(f"Error cleaning up finished process {task_id}: {e}")

    def get_active_count(self) -> int:
        """Get the number of active (running) processes."""
        with self._lock:
            return sum(1 for p in self._processes.values() if p.is_alive())


# Global process manager instance
process_manager = ProcessManager()
