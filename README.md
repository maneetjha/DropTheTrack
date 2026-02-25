# DropTheTrack

DropTheTrack is a real-time collaborative music room platform where a group can build a shared queue, vote on what should play next, and listen together with synced playback controls.

## Product Description

### What problem it solves

In group listening sessions, one person usually controls the music while everyone else sends requests in chat. DropTheTrack turns this into a shared, structured experience:

- The host creates a room and shares a short room code.
- Members join and add tracks from YouTube.
- The queue is ranked by votes, so the group decides what should play next.
- Playback and room activity are synchronized live for all participants.

### What the product does

DropTheTrack combines queue management, playback control, and room communication in a single collaborative interface.

#### 1) Room creation and joining

- Signed-in users can create rooms with unique short codes.
- Guests/friends can join rooms by code.
- Membership is tracked so users can quickly return to recent rooms.

#### 2) Collaborative song queue

- Users search YouTube directly from inside a room.
- Songs can be added to the room queue with title, link, and thumbnail.
- The queue automatically sorts by:
  1. Most upvotes
  2. Oldest submission (tie-breaker)

#### 3) Voting-driven playback order

- Participants can upvote songs to move them higher in the queue.
- Voting is toggle-based (upvote/remove vote) and reflected in real time.
- This makes the next track selection community-driven instead of host-only.

#### 4) Host controls and room moderation

- The room host can:
  - Start playback
  - Skip songs
  - Clear upcoming queue items
  - Delete the room
  - Switch room mode between:
    - `open` (everyone can add)
    - `listen_only` (only host can add)
- Non-host users can remove songs they submitted; hosts can remove any song.

#### 5) Real-time synchronization

- Live room events are pushed with Socket.io:
  - queue updates
  - user presence updates
  - room setting updates
  - playback sync signals
  - chat messages
- Playback state (pause/resume + timestamp) is stored in Redis to keep clients aligned.
- Auto-advance logic moves to the next track when a song ends.

#### 6) Room chat and social context

- Each room has chat with persisted message history.
- User presence shows who is online and who is hosting.
- Dashboard views display live listener activity.

#### 7) Authentication and identity

- Email/password auth and Google OAuth are supported.
- JWT-based auth secures protected room and queue actions.

## Core User Flow

1. Sign up or log in.
2. Create a room (or join by code).
3. Share room code with friends.
4. Search and add songs from YouTube.
5. Vote tracks up to shape queue order.
6. Host starts playback, and everyone listens in sync.
7. Keep chatting and updating the queue in real time.

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
    config/        # DB & Redis connections
    routes/        # REST API (auth, rooms, songs, messages, youtube)
    sockets/       # Real-time event handlers
    middleware/    # JWT auth middleware
    cron/          # Scheduled cleanup jobs
  prisma/          # Schema & migrations

frontend/
  src/
    app/           # Next.js pages (home, login, register, room/[id])
    components/    # UI components (Navbar, RoomCard, YouTubePlayer, Chat, etc.)
    lib/           # API client, auth context, socket helper
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
