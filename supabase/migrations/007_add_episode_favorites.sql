-- Migration: Add episode favorites table
-- Date: 2026-02-24

-- Enable uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create episode favorites table
CREATE TABLE pc_episode_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES pc_episodes(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, episode_id)
);

-- Add index for user_id
CREATE INDEX idx_pc_episode_favorites_user_id ON pc_episode_favorites(user_id);

-- Enable RLS
ALTER TABLE pc_episode_favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can access own episode favorites
CREATE POLICY "Users can access own episode favorites" ON pc_episode_favorites
  FOR ALL USING (auth.uid() = user_id);
