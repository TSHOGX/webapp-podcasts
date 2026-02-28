-- Migration: Fix episode_favorites user_id column (remove invalid FK to auth.users)
-- Date: 2026-02-28

-- 移除无效的外键约束
ALTER TABLE pc_episode_favorites DROP CONSTRAINT IF EXISTS pc_episode_favorites_user_id_fkey;

-- 确认 RLS 策略存在（确保用户只能访问自己的收藏）
DROP POLICY IF EXISTS "Users can access own episode favorites" ON pc_episode_favorites;
CREATE POLICY "Users can access own episode favorites" ON pc_episode_favorites
  FOR ALL USING (auth.uid() = user_id);
