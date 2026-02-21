-- Migration to remove pc_users table and update related foreign keys
-- This migration removes the custom user table in favor of using Supabase auth.users directly

-- Step 1: Drop the trigger and function that creates pc_users entries
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 2: Drop foreign key constraints from tables referencing pc_users
-- Note: We need to drop and recreate these constraints without the foreign key reference
-- since auth.users is a system table and cannot be referenced by foreign keys

-- For pc_transcriptions
ALTER TABLE pc_transcriptions DROP CONSTRAINT IF EXISTS pc_transcriptions_user_id_fkey;

-- For pc_favorites
ALTER TABLE pc_favorites DROP CONSTRAINT IF EXISTS pc_favorites_user_id_fkey;

-- For pc_playback_progress
ALTER TABLE pc_playback_progress DROP CONSTRAINT IF EXISTS pc_playback_progress_user_id_fkey;

-- Step 3: Drop pc_users table
DROP TABLE IF EXISTS pc_users CASCADE;

-- Step 4: Update RLS policies that referenced pc_users
-- The existing policies using auth.uid() = user_id will continue to work
-- since they compare UUIDs directly without needing foreign keys

-- Step 5: Drop the RLS policy for pc_users (table no longer exists)
-- This is automatically handled by CASCADE when dropping the table
