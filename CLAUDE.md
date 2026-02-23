# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

> 📚 **详细文档**: 参见 `docs/` 目录
> - [docs/FEATURES.md](./docs/FEATURES.md) - 功能总览
> - [docs/AI_CHAT.md](./docs/AI_CHAT.md) - AI 总结与对话
> - [docs/TRANSCRIPTION.md](./docs/TRANSCRIPTION.md) - 转录功能
> - [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) - 部署指南

## Project Overview

Full-stack podcast transcription webapp:
- **Frontend**: Next.js 16+, React 19, TypeScript, Tailwind, shadcn/ui
- **Backend**: FastAPI (Python), mlx-whisper for transcription
- **Database**: PostgreSQL + Supabase (RLS enabled)
- **Package Manager**: Yarn 4
- **Monorepo**: Turborepo

## Development Commands

```bash
yarn install      # Install dependencies
yarn dev          # Start all dev servers
yarn build        # Production build
yarn lint         # Run linting
yarn type-check   # TypeScript check
```

## Architecture

### Frontend (`apps/web/`)

**Routes** (Next.js App Router):
- `(auth)/` - Login, register
- `(main)/` - Protected routes
  - `search/` - Podcast search (iTunes API)
  - `[id]/` - Podcast detail
  - `episodes/[id]/` - Episode + transcription
  - `favorites/` - Saved podcasts
  - `settings/` - AI config, theme
  - `transcriptions/` - Transcription management

**Key Directories**:
- `app/api/` - Next.js API routes
- `components/ai/` - AI chat components
- `components/transcription/` - Transcription viewer
- `lib/supabase/` - Supabase clients
- `store/` - Zustand stores (ai-store, player-store)

**Config**:
- `basePath: '/podcasts'` for Gateway
- `middleware.ts` - Auth session management

### Backend (`apps/api/`)

- `main.py` - FastAPI app with WebSocket
- `transcribe.py` - mlx-whisper transcription service
- Queue-based async processing

### Database

Tables (prefixed `pc_`):
- `users`, `podcasts`, `episodes`, `transcriptions`
- `favorites`, `playback_progress`
- `ai_chats`, `user_settings`

RLS enabled. Server uses service role key.

## Key Features

1. **Transcription** - Whisper-based with timestamps
   - See [TRANSCRIPTION.md](./docs/TRANSCRIPTION.md)

2. **AI Chat & Summary** - LLM-powered analysis
   - See [AI_CHAT.md](./docs/AI_CHAT.md)

3. **Settings** - `/settings` for AI provider, prompts, theme

## Environment Variables

**Frontend** (`.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
NEXT_PUBLIC_API_URL=http://127.0.0.1:12890
SUPABASE_SERVICE_ROLE_KEY=<key>
```

**Backend** (`.env`):
```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<key>
WHISPER_MODEL=mlx-community/whisper-large-v3-turbo
TEMP_AUDIO_DIR=/tmp/podcast-transcribe
```

## Migration Files

`supabase/migrations/`:
- `001_initial_schema.sql`
- `002_remove_pc_users.sql`
- `003_add_episode_guid.sql`
- `004_add_transcription_segments.sql`
- `005_add_cancelled_status.sql`
- `006_add_ai_tables.sql`

## Deployment

Production ports:
- Frontend: 12889
- Backend: 12890

```bash
pm2 start apps/web/pm2.config.js
pm2 start apps/api/pm2.config.js
```

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for Gateway integration.
