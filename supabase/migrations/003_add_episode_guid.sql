-- Add guid column to pc_episodes table to store RSS GUID
ALTER TABLE pc_episodes ADD COLUMN guid TEXT UNIQUE;

-- Create index for guid lookups
CREATE INDEX idx_pc_episodes_guid ON pc_episodes(guid);
