# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack podcast transcription webapp with the following architecture:
- **Frontend**: Next.js 16+ (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: FastAPI (Python) for transcription services using mlx-whisper
- **Database**: PostgreSQL with Supabase (Row Level Security enabled)
- **Package Manager**: Yarn 4 with node-modules linker
- **Monorepo**: Turborepo with workspaces in `apps/*` and `packages/*`

## Development Commands

All commands should be run from the repository root unless specified otherwise.

```bash
# Install dependencies (root + all workspaces)
yarn install

# Start all development servers (frontend + backend)
yarn dev

# Build all applications for production
yarn build

# Run linting across all packages
yarn lint

# Run TypeScript type checking
yarn type-check

# Clean build artifacts
yarn clean
```

### Individual Service Commands

**Frontend (Next.js)** - Port 3000 (dev), 12889 (prod):
```bash
cd apps/web
yarn dev          # Development server
yarn build        # Production build
yarn start        # Production server (port 12889)
yarn lint         # ESLint
yarn type-check   # TypeScript check
```

**Backend (FastAPI)** - Port 12890:
```bash
cd apps/api
python main.py    # Start development server

# Production (via PM2)
pm2 start apps/api/pm2.config.js
```

**Database (Supabase)**:
```bash
supabase start           # Start local Supabase
supabase db reset        # Reset database and apply migrations
supabase status          # Check local Supabase status
```

## Application Architecture

### Frontend Structure (`apps/web/`)

**Route Groups** (Next.js App Router):
- `(auth)/` - Authentication routes (login, register)
- `(main)/` - Protected app routes requiring authentication
  - `[id]/` - Podcast detail page (dynamic, from search)
  - `episodes/[id]/` - Episode detail page
  - `favorites/` - User's favorite podcasts
  - `search/` - Podcast search (iTunes API)
  - `transcriptions/` - Transcription management

**Key Directories**:
- `app/api/` - Next.js API routes (proxied to FastAPI for transcription)
- `components/` - React components organized by feature
- `lib/supabase/` - Supabase client configuration and middleware
- `lib/auth.ts` - Authentication utilities
- `store/` - Zustand state management stores
- `types/` - TypeScript type definitions

**Important Configuration**:
- `next.config.ts` uses `basePath: '/podcasts'` for Gateway integration
- `middleware.ts` handles auth session management and protected route redirects
- Route protection is defined in `lib/supabase/middleware.ts` (`protectedRoutes` array)

### Backend Structure (`apps/api/`)

- `main.py` - FastAPI application with WebSocket support for real-time transcription updates
- `transcribe.py` - Transcription service using mlx-whisper (Apple Silicon optimized)
- Queue-based processing with async worker pattern

### Database Schema

All tables prefixed with `pc_`:
- `pc_users` - User profiles (extends Supabase auth.users)
- `pc_podcasts` - Podcast metadata from iTunes
- `pc_episodes` - Podcast episodes with RSS GUID support
- `pc_transcriptions` - Transcription jobs and results
- `pc_favorites` - User-podcast favorites (many-to-many)
- `pc_playback_progress` - Episode playback progress tracking

Row Level Security (RLS) is enabled on all tables. Server-side operations bypass RLS using the service role key.

### Authentication Flow

1. Supabase Auth handles email/password authentication
2. `middleware.ts` validates sessions on each request
3. Protected routes (`/favorites`, `/transcriptions`) redirect unauthenticated users to login
4. Test mode: Set `NEXT_PUBLIC_TEST_MODE=true` to bypass auth (development only)

### Transcription Flow

1. Frontend calls `POST /api/transcribe` (Next.js API route)
2. Route handler creates/updates episode record in Supabase
3. Forwards request to FastAPI backend
4. FastAPI downloads audio, transcribes with mlx-whisper
5. WebSocket connection provides real-time progress updates
6. Results stored in `pc_transcriptions` table

## Environment Variables

**Frontend (`apps/web/.env.local`)**:
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
NEXT_PUBLIC_API_URL=http://127.0.0.1:12890
SUPABASE_SERVER_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

**Backend (`apps/api/.env`)**:
```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
WHISPER_MODEL=mlx-community/whisper-large-v3-turbo
TEMP_AUDIO_DIR=/tmp/podcast-transcribe
```

Note: `SUPABASE_SERVER_URL` and `SUPABASE_SERVICE_ROLE_KEY` are server-only (no `NEXT_PUBLIC_` prefix).

## Deployment

Production uses PM2 for process management:

```bash
# Frontend
pm2 start apps/web/pm2.config.js

# Backend
pm2 start apps/api/pm2.config.js

# Save PM2 config
pm2 save
```

Production ports:
- Frontend: 12889
- Backend: 12890

## Key Implementation Patterns

### Supabase Client Usage

- **Browser/Component**: Use `createBrowserClient` from `@/lib/supabase/client`
- **Server Components/API Routes**: Use `createClient` from `@/lib/supabase/server`
- **Admin/RLS bypass**: Use `createServiceClient` from `@/lib/supabase/server`

### API Error Handling

Transcription API routes have structured error responses with:
- `error`: Human-readable message
- `code`: Machine-readable error code
- `hint`: Resolution guidance

Common error codes: `MISSING_SUPABASE_SERVICE_ROLE_KEY`, `INVALID_SERVICE_ROLE_KEY`, `TRANSCRIPTION_SERVICE_ERROR`

### Audio Player

Uses Howler.js for audio playback and wavesurfer.js for waveform visualization. State managed via Zustand store.

## External APIs

- **iTunes API**: Podcast search and metadata (`https://itunes.apple.com`)
- **RSS Feeds**: Episode data parsed with `fast-xml-parser`

## Migration Files

Located in `supabase/migrations/`:
- `001_initial_schema.sql` - Base schema with RLS policies
- `002_remove_pc_users.sql` - Remove manual pc_users table (using trigger instead)
- `003_add_episode_guid.sql` - Add RSS GUID support for episode linking
