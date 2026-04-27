# LIGMA

Let's Integrate Groups, Manage Anything.

LIGMA is a real-time collaborative workspace project that connects ideation on an infinite canvas with team execution workflows.  
This repository currently includes the monorepo foundation, authentication, workspace management, and real-time event sync infrastructure.

## What Collaborators Should Know First

- **Repo style:** npm workspaces monorepo (`server` + `client`)
- **Backend:** Node.js + Express + Socket.IO + PostgreSQL + Yjs
- **Frontend:** Vite + vanilla JS + Socket.IO client + Yjs
- **Auth model:** JWT access token + httpOnly refresh cookie
- **Data model approach:** Event sourcing for canvas events
- **Current UI state:** Auth flow and a basic workspace shell are implemented; full canvas/task board UI is planned

## Current Implementation Snapshot

This reflects the code in the repository today:

### Implemented

- Server bootstrapping with health endpoint (`GET /api/health`)
- PostgreSQL connection and migration system
- Auth routes (`register`, `login`, `refresh`, `logout`, `me`)
- Workspace routes (create/list/get/invite/update roles)
- RBAC middleware for role-based workspace access
- Socket gateway + handlers + Yjs sync modules
- Client auth UI and API client wrapper
- Client socket and Yjs provider modules

### Planned / In Progress

- Full infinite canvas experience (fabric.js integration)
- Task extraction and Kanban board
- Time-travel UI
- Full role-aware UI controls and deployment polish

For detailed scope and sequencing, see `implementation_plan_ligma_tasks.md`.

## Repository Structure

```text
.
├─ client/                 # Vite frontend app
│  ├─ src/auth/            # Login/Register UI
│  ├─ src/net/             # API, Socket.IO, Yjs provider
│  └─ src/styles/          # Shared + auth styles
├─ server/                 # Express + Socket.IO backend
│  └─ src/
│     ├─ db/               # PostgreSQL pool + migrations
│     ├─ middleware/        # auth + RBAC
│     ├─ routes/            # auth/workspace APIs
│     ├─ services/          # business logic + event services
│     └─ ws/                # websocket gateway/handlers/yjs sync
├─ docker-compose.yml      # Local PostgreSQL (+ optional pgAdmin)
└─ implementation_plan_ligma_tasks.md
```

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+
- Docker Desktop (for local PostgreSQL)

## Local Setup (Fast Path)

1. Install dependencies from repo root:

```bash
npm install
```

2. Create your local env file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Start PostgreSQL:

```bash
docker compose up -d
```

4. Run database migrations:

```bash
npm run migrate --workspace server
```

5. Start backend + frontend together:

```bash
npm run dev
```

6. Open the app:

- Client: `http://localhost:5173`
- Server health: `http://localhost:3000/api/health`

## Environment Variables

Defined in `.env.example`:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - signing secret for JWTs
- `PORT` - backend port (default `3000`)
- `CLIENT_URL` - frontend origin for CORS (default `http://localhost:5173`)

## Common Commands

From repo root:

- `npm run dev` - run server + client concurrently
- `npm run dev:server` - run backend only
- `npm run dev:client` - run frontend only
- `npm run build` - build client
- `npm run start` - start backend in non-dev mode
- `npm run migrate --workspace server` - run DB migrations

## API Surface (Current)

### Health

- `GET /api/health`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Workspaces

- `POST /api/workspaces`
- `GET /api/workspaces`
- `GET /api/workspaces/:id`
- `POST /api/workspaces/:id/invite`
- `PATCH /api/workspaces/:id/roles/:userId`

## Collaboration Notes

- Main planning document: `implementation_plan_ligma_tasks.md`
- Keep features aligned with phase checkpoints in the plan
- Prefer additive PRs scoped to one phase or sub-phase
- Avoid committing generated build artifacts unless explicitly required

## Troubleshooting

### Database auth failure on startup

If the server reports PostgreSQL credential mismatch:

```bash
docker compose down -v
docker compose up -d
```

Then rerun migration and server startup commands.

### Missing env vars

If server startup fails with "Missing required environment variables", verify `.env` exists at repo root and includes all keys from `.env.example`.

## Next Recommended Contribution Areas

- Build the Phase 5 canvas modules (`CanvasEngine`, `NodeManager`, `SyncBridge`)
- Wire the workspace list page to live `workspaces` API
- Add smoke tests for auth, workspace APIs, and websocket handshake

