-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (pc_users) - extends Supabase auth.users
CREATE TABLE pc_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Podcasts table
CREATE TABLE pc_podcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  itunes_id BIGINT UNIQUE,
  title VARCHAR(500) NOT NULL,
  author VARCHAR(255),
  description TEXT,
  rss_url TEXT,
  artwork_url TEXT,
  genre VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Episodes table
CREATE TABLE pc_episodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  podcast_id UUID REFERENCES pc_podcasts(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  audio_url TEXT,
  duration INTEGER,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Transcriptions table
CREATE TABLE pc_transcriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES pc_users(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES pc_episodes(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending',
  text TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Favorites table
CREATE TABLE pc_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES pc_users(id) ON DELETE CASCADE,
  podcast_id UUID REFERENCES pc_podcasts(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, podcast_id)
);

-- Playback progress table
CREATE TABLE pc_playback_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES pc_users(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES pc_episodes(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, episode_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_pc_episodes_podcast_id ON pc_episodes(podcast_id);
CREATE INDEX idx_pc_transcriptions_user_id ON pc_transcriptions(user_id);
CREATE INDEX idx_pc_transcriptions_episode_id ON pc_transcriptions(episode_id);
CREATE INDEX idx_pc_transcriptions_status ON pc_transcriptions(status);
CREATE INDEX idx_pc_favorites_user_id ON pc_favorites(user_id);
CREATE INDEX idx_pc_playback_progress_user_id ON pc_playback_progress(user_id);

-- Enable Row Level Security
ALTER TABLE pc_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pc_podcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pc_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pc_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pc_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE pc_playback_progress ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- pc_users: Users can read their own data
CREATE POLICY "Users can read own data" ON pc_users
  FOR SELECT USING (auth.uid() = id);

-- pc_podcasts: Public read access
CREATE POLICY "Public read access" ON pc_podcasts
  FOR SELECT USING (true);

-- pc_episodes: Public read access
CREATE POLICY "Public read access" ON pc_episodes
  FOR SELECT USING (true);

-- pc_transcriptions: Users can only access their own transcriptions
CREATE POLICY "Users can access own transcriptions" ON pc_transcriptions
  FOR ALL USING (auth.uid() = user_id);

-- pc_favorites: Users can only access their own favorites
CREATE POLICY "Users can access own favorites" ON pc_favorites
  FOR ALL USING (auth.uid() = user_id);

-- pc_playback_progress: Users can only access their own progress
CREATE POLICY "Users can access own progress" ON pc_playback_progress
  FOR ALL USING (auth.uid() = user_id);

-- Function to create pc_users entry when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.pc_users (id, email, name, created_at, updated_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create pc_users entry
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
