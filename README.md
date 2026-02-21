# Podcast Transcription Webapp

A full-featured podcast webapp for searching podcasts, listening to episodes, and transcribing audio using Whisper.

## Features

- **User Authentication**: Email-based registration and login via Supabase Auth
- **Podcast Search**: Search millions of podcasts using Apple iTunes API
- **Episode Browser**: Browse podcast episodes with RSS feed parsing
- **Audio Player**: Full-featured player with playback controls, speed adjustment, and waveform visualization
- **Transcription**: Transcribe podcast episodes using mlx-whisper (Apple Silicon optimized)
- **Transcription Management**: View, search, and export transcriptions
- **Favorites**: Save favorite podcasts for quick access
- **Playback History**: Track playback progress

## Tech Stack

- **Frontend**: Next.js 16+ (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes + FastAPI (Python)
- **Database**: PostgreSQL with Supabase
- **Audio**: Howler.js + wavesurfer.js
- **Transcription**: mlx-whisper
- **Deployment**: PM2

## Project Structure

```
podcast-webapp/
├── apps/
│   ├── web/                    # Next.js frontend (port 3000 dev, 12889 prod)
│   │   ├── app/               # Next.js App Router
│   │   ├── components/        # React components
│   │   ├── lib/              # Utility functions
│   │   ├── types/            # TypeScript types
│   │   └── pm2.config.js     # PM2 frontend configuration
│   └── api/                   # FastAPI backend (port 12890)
│       ├── main.py           # FastAPI application
│       ├── transcribe.py     # Transcription service
│       └── pm2.config.js     # PM2 backend configuration
├── supabase/
│   └── migrations/           # Database migrations
├── package.json              # Root package.json
└── turbo.json               # Turborepo configuration
```

## Prerequisites

- Node.js 20+
- Python 3.11+
- Supabase CLI (for local development)
- PM2 (for production deployment)

## Setup

### 1. Clone and Install Dependencies

```bash
cd podcast-webapp
npm install
cd apps/web
npm install
cd ../api
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create `.env.local` in `apps/web/`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
NEXT_PUBLIC_API_URL=http://127.0.0.1:12890
SUPABASE_SERVICE_ROLE_KEY=sb_secret_your_service_role_key
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only and is used by Next.js API routes.
Do not prefix it with `NEXT_PUBLIC_`.

Create `.env` in `apps/api/`:

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
WHISPER_MODEL=mlx-community/whisper-large-v3-turbo
TEMP_AUDIO_DIR=/tmp/podcast-transcribe
```

### 3. Start Supabase

```bash
supabase start
```

### 4. Run Database Migrations

```bash
supabase db reset
```

Or manually run the migration file in the Supabase Studio SQL Editor.

### 5. Start Development Servers

```bash
# From root directory
npm run dev

# Or run individually:
# Frontend
cd apps/web && npm run dev

# Backend
cd apps/api && python main.py
```

## Production Deployment

### Build Frontend

```bash
cd apps/web
npm run build
```

### Start with PM2

```bash
# Frontend
pm2 start apps/web/pm2.config.js

# Backend
pm2 start apps/api/pm2.config.js

# Save PM2 configuration
pm2 save
```

The application will be available at:
- Frontend: http://localhost:12889
- Backend API: http://localhost:12890

## Database Schema

### Tables (all prefixed with `pc_`)

- **pc_users**: User profiles
- **pc_podcasts**: Podcast metadata from iTunes
- **pc_episodes**: Podcast episodes from RSS feeds
- **pc_transcriptions**: Transcription jobs and results
- **pc_favorites**: User's favorite podcasts
- **pc_playback_progress**: Episode playback progress

## API Endpoints

### Podcast Search
- `GET /api/podcasts/search?q=query&limit=20` - Search podcasts via iTunes API
- `GET /api/podcasts/[id]?itunesId=xxx` - Get podcast details with episodes

### Transcription
- `POST /api/transcribe` - Create transcription job
- `GET /api/transcriptions` - List user's transcriptions
- `DELETE /api/transcriptions/[id]` - Delete transcription

### Favorites
- `GET /api/favorites` - List user's favorites
- `POST /api/favorites` - Add podcast to favorites
- `DELETE /api/favorites/[id]` - Remove from favorites

## License

MIT
