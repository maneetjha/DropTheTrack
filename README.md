# DropTheTrack

Collaborative music rooms where friends add songs, upvote the queue, and listen together in real time.

## Tech Stack

- **Frontend** -- Next.js 16, React 19, Tailwind CSS 4, TypeScript
- **Backend** -- Node.js, Express, Prisma ORM
- **Realtime** -- Socket.io (WebSocket)
- **Database** -- PostgreSQL 16, Redis 7
- **Auth** -- Google OAuth + JWT

## Getting Started

### Prerequisites

Docker, Node.js 20+

### 1. Infrastructure

```bash
docker compose up -d   # starts Postgres & Redis
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # fill in your Google OAuth & YouTube API keys
npm install
npx prisma migrate dev
npm run dev             # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL if needed
npm install
npm run dev             # http://localhost:3000
```

## Project Structure

```
backend/
  src/
    config/       # DB & Redis connections
    routes/       # REST API (auth, rooms, songs, messages, youtube)
    sockets/      # Real-time event handlers
    middleware/    # JWT auth middleware
    cron/         # Scheduled cleanup jobs
  prisma/         # Schema & migrations

frontend/
  src/
    app/          # Next.js pages (home, login, register, room/[id])
    components/   # UI components (Navbar, RoomCard, YouTubePlayer, Chat, etc.)
    lib/          # API client, auth context, socket helper
```

## Environment Variables

See `backend/.env.example` for the full list. Key ones:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `JWT_SECRET` | Secret for signing JWTs |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key |

## License

MIT
