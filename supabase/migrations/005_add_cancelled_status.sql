-- Migration: Add support for cancelled transcription status and task tracking
-- Adds 'cancelled' as a valid status option and task_id for cancellation tracking

-- Add task_id column for tracking FastAPI task IDs (enables cancellation)
ALTER TABLE pc_transcriptions ADD COLUMN IF NOT EXISTS task_id VARCHAR(255);

-- Create index for task_id lookups
CREATE INDEX IF NOT EXISTS idx_pc_transcriptions_task_id ON pc_transcriptions(task_id);

-- Note: The status column is already VARCHAR(50) which can store any string value,
-- so we just need to ensure any application-level constraints/checks are aware of 'cancelled'

-- Add comment to document valid status values
COMMENT ON COLUMN pc_transcriptions.status IS 'Transcription status: pending, processing, completed, failed, or cancelled';

-- Add comment for task_id column
COMMENT ON COLUMN pc_transcriptions.task_id IS 'FastAPI task ID for cancellation tracking';

-- Create index for cancelled status queries (if needed for filtering)
CREATE INDEX IF NOT EXISTS idx_pc_transcriptions_status_cancelled ON pc_transcriptions(status) WHERE status = 'cancelled';
