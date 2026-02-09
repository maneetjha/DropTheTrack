# DropTheTrack

A collaborative music queue where users create rooms, add songs, and upvote to decide what plays next. Built for both desktop and mobile.

## Tech Stack

| Layer    | Tech                              |
| -------- | --------------------------------- |
| Frontend | Next.js 16, Tailwind CSS 4, TypeScript |
| Backend  | Node.js, Express, Socket.io       |
| Database | PostgreSQL 16                     |
| Cache    | Redis 7                           |
| Realtime | Socket.io (WebSocket)             |

## Quick Start

### 1. Start Postgres & Redis

```bash
docker compose up -d
```

### 2. Start the Backend

```bash
cd backend
cp .env.example .env   # already done if you cloned fresh
npm install
npm run dev
```

Backend runs on **http://localhost:4000**. Health check: `GET /api/ping`

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on **http://localhost:3000**

## API Endpoints

| Method | Endpoint                        | Description              |
| ------ | ------------------------------- | ------------------------ |
| GET    | `/api/ping`                     | Health check (DB + Redis)|
| POST   | `/api/rooms`                    | Create a room            |
| GET    | `/api/rooms`                    | List all rooms           |
| GET    | `/api/rooms/:id`                | Get room by ID           |
| POST   | `/api/rooms/:roomId/songs`      | Add song to room         |
| GET    | `/api/rooms/:roomId/songs`      | Get song queue for room  |
| POST   | `/api/songs/:songId/upvote`     | Upvote a song            |

## Socket Events

| Event            | Direction      | Payload                     |
| ---------------- | -------------- | --------------------------- |
| `join-room`      | Client -> Server | `roomId`                  |
| `leave-room`     | Client -> Server | `roomId`                  |
| `song-added`     | Client -> Server | `{ roomId, song }`        |
| `song-upvoted`   | Client -> Server | `{ roomId, songId, upvotes }` |
| `queue-updated`  | Server -> Client | `{ song/songId, action }` |
| `user-joined`    | Server -> Client | `{ socketId }`            |
| `user-left`      | Server -> Client | `{ socketId }`            |

## Project Structure

```
DropTheTrack/
├── backend/
│   ├── src/
│   │   ├── config/      # DB & Redis connections
│   │   ├── routes/       # Express routes
│   │   ├── sockets/      # Socket.io handlers
│   │   └── index.js      # Entry point
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js pages (home + room)
│   │   ├── components/   # UI components
│   │   └── lib/          # API client + Socket helper
│   ├── .env.local
│   └── package.json
├── docker-compose.yml
└── README.md
```
