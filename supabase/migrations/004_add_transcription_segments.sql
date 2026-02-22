-- Migration: Add transcription segments support
-- Adds columns for storing timestamped transcription data

-- Add segments field to store timestamped transcription data (JSONB for flexibility)
ALTER TABLE pc_transcriptions ADD COLUMN IF NOT EXISTS segments JSONB;

-- Add language field to store detected language
ALTER TABLE pc_transcriptions ADD COLUMN IF NOT EXISTS language VARCHAR(10);

-- Add comment to explain the segments structure
COMMENT ON COLUMN pc_transcriptions.segments IS 'JSON array of transcription segments with timestamps. Format: [{"id": 0, "start": 0.0, "end": 5.5, "text": "...", "words": [{"word": "...", "start": 0.0, "end": 0.5}]}]';

-- Add comment for language column
COMMENT ON COLUMN pc_transcriptions.language IS 'Detected language code (e.g., "en", "zh", "es")';

-- Create index on language for potential filtering
CREATE INDEX IF NOT EXISTS idx_pc_transcriptions_language ON pc_transcriptions(language);
