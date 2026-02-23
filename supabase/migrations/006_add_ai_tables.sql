-- Migration: Add AI chat and user settings tables for AI summary and conversation features

-- ============================================
-- AI Chats Table: Stores all AI conversation history
-- ============================================
CREATE TABLE IF NOT EXISTS pc_ai_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transcription_id UUID REFERENCES pc_transcriptions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content TEXT NOT NULL,
  model VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE pc_ai_chats ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own chats
CREATE POLICY "Users can access own AI chats" ON pc_ai_chats
  FOR ALL USING (auth.uid() = user_id);

-- Indexes for AI chats
CREATE INDEX IF NOT EXISTS idx_pc_ai_chats_transcription ON pc_ai_chats(transcription_id);
CREATE INDEX IF NOT EXISTS idx_pc_ai_chats_user ON pc_ai_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_pc_ai_chats_created ON pc_ai_chats(created_at);

-- Comments for documentation
COMMENT ON TABLE pc_ai_chats IS 'Stores AI conversation history including automatic summaries and user chats';
COMMENT ON COLUMN pc_ai_chats.role IS 'Message role: system, user, or assistant';
COMMENT ON COLUMN pc_ai_chats.metadata IS 'Additional metadata like temperature, prompt_template, system_prompt, auto_generated flag';


-- ============================================
-- User Settings Table: Stores user-level AI configuration
-- ============================================
CREATE TABLE IF NOT EXISTS pc_user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  llm_provider VARCHAR(50) NOT NULL,
  llm_api_key TEXT NOT NULL,
  llm_base_url TEXT,
  llm_model VARCHAR(100) NOT NULL,
  system_prompt TEXT DEFAULT '你是一个专业的播客内容分析师，擅长从转录文本中提取关键信息并生成结构化的内容总结。',
  user_prompt_template TEXT DEFAULT '请根据以下播客转录文本，生成一份结构化的内容总结：\n\n{{transcription}}\n\n请包含以下部分：\n1. 核心观点概述\n2. 关键话题与讨论要点\n3. 重要引用或案例\n4. 结论与启发',
  temperature DECIMAL(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  enable_auto_summary BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE pc_user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own settings
CREATE POLICY "Users can access own settings" ON pc_user_settings
  FOR ALL USING (auth.uid() = user_id);

-- Index for user settings lookup
CREATE INDEX IF NOT EXISTS idx_pc_user_settings_user ON pc_user_settings(user_id);

-- Comments for documentation
COMMENT ON TABLE pc_user_settings IS 'Stores user AI configuration including API keys (encrypted), model settings, and prompt templates';
COMMENT ON COLUMN pc_user_settings.llm_provider IS 'LLM provider: kimi, openai, anthropic, custom';
COMMENT ON COLUMN pc_user_settings.llm_api_key IS 'Encrypted API key for the LLM provider';
COMMENT ON COLUMN pc_user_settings.llm_base_url IS 'Optional custom API endpoint URL';
COMMENT ON COLUMN pc_user_settings.user_prompt_template IS 'Template for summary generation, use {{transcription}} as placeholder';
COMMENT ON COLUMN pc_user_settings.temperature IS 'LLM temperature parameter (0-2)';
COMMENT ON COLUMN pc_user_settings.enable_auto_summary IS 'Whether to automatically generate summary after transcription completes';


-- ============================================
-- Function to update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on settings changes
DROP TRIGGER IF EXISTS update_pc_user_settings_updated_at ON pc_user_settings;
CREATE TRIGGER update_pc_user_settings_updated_at
  BEFORE UPDATE ON pc_user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
