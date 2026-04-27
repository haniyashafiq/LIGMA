# LIGMA — Implementation Plan

**Let's Integrate Groups, Manage Anything**
A real-time collaborative workspace bridging ideation (infinite canvas) and execution (task board).

---

## Overview

This plan translates the [approved architecture](file:///C:/Users/DC/.gemini/antigravity/brain/420c2609-9b4f-4196-9211-52b81e3f6527/implementation_plan.md) into a sequenced build-out. Each phase produces a testable artifact. Phases are ordered by dependency — later phases build on earlier ones.

### Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Vite (vanilla JS + ES modules), HTML5 Canvas, Yjs |
| Backend | Node.js, Express, Socket.IO, Yjs server |
| Database | PostgreSQL 16 (Docker for dev, Render addon for prod) |
| AI/NLP | `natural` (Naive Bayes) + rule-based boosters |
| Auth | JWT access tokens (in-memory) + httpOnly refresh cookies |
| CRDT | Yjs for conflict-free real-time text/state sync |
| Deployment | Render (via `render.yaml` Blueprint) |

### Current State

- `docker-compose.yml` — PostgreSQL 16 container ✅
- `.env.example` — Environment template ✅
- `server/` — **Empty**, needs full implementation
- `client/` — **Empty**, needs full implementation

---

## Phase 1 — Project Scaffolding & Configuration

> [!NOTE]
> **Goal**: Monorepo structure, dev tooling, all config files. Both `npm run dev` (server) and `npm run dev` (client) start without errors.

### Task 1.1 — Root Monorepo Setup
- [ ] Create root `package.json` with npm workspaces: `["server", "client"]`
- [ ] Add root scripts: `dev`, `dev:server`, `dev:client`, `build`, `start`
- [ ] Add `.gitignore` (node_modules, .env, dist, pgdata)

**File**: [package.json](file:///d:/Projects/LIGMA/package.json)

### Task 1.2 — Server Package Init
- [ ] Create `server/package.json` with dependencies:
  - `express`, `cors`, `cookie-parser`, `dotenv`
  - `pg` (PostgreSQL driver)
  - `socket.io`
  - `yjs`, `y-protocols`
  - `jsonwebtoken`, `bcrypt`
  - `natural` (NLP)
  - `uuid`
- [ ] Dev dependencies: `nodemon`
- [ ] Add scripts: `dev` (nodemon), `start`, `migrate`
- [ ] Create `server/src/index.js` — Minimal Express + Socket.IO startup (health check at `GET /api/health`)
- [ ] Create `server/src/config.js` — Load and validate env vars (`DATABASE_URL`, `JWT_SECRET`, `PORT`, `CLIENT_URL`)

**Files**:
- [server/package.json](file:///d:/Projects/LIGMA/server/package.json)
- [server/src/index.js](file:///d:/Projects/LIGMA/server/src/index.js)
- [server/src/config.js](file:///d:/Projects/LIGMA/server/src/config.js)

### Task 1.3 — Client Package Init (Vite)
- [ ] Initialize Vite project in `client/` (vanilla JS template)
- [ ] Add dependencies: `yjs`, `socket.io-client`
- [ ] Create minimal `index.html` with viewport meta and font imports (Inter, JetBrains Mono)
- [ ] Create `client/src/styles/index.css` — Design system tokens (CSS custom properties for colors, spacing, typography, glassmorphism mixins)
- [ ] Create `client/src/main.js` — App bootstrap shell (shows "LIGMA" title)
- [ ] Configure `vite.config.js` — Proxy `/api` and `/socket.io` to server in dev

**Files**:
- [client/package.json](file:///d:/Projects/LIGMA/client/package.json)
- [client/vite.config.js](file:///d:/Projects/LIGMA/client/vite.config.js)
- [client/index.html](file:///d:/Projects/LIGMA/client/index.html)
- [client/src/main.js](file:///d:/Projects/LIGMA/client/src/main.js)
- [client/src/styles/index.css](file:///d:/Projects/LIGMA/client/src/styles/index.css)

### Task 1.4 — Docker & Deployment Config
- [ ] Update `docker-compose.yml` — Add pgAdmin service (optional, for DB inspection)
- [ ] Create `render.yaml` — Render Blueprint (web service + PostgreSQL addon)
- [ ] Update `.env.example` if any new vars are needed

**Files**:
- [docker-compose.yml](file:///d:/Projects/LIGMA/docker-compose.yml)
- [render.yaml](file:///d:/Projects/LIGMA/render.yaml)

### ✅ Phase 1 Checkpoint
- `docker compose up` starts PostgreSQL
- `npm run dev:server` starts Express on `:3000`, `GET /api/health` returns `200`
- `npm run dev:client` starts Vite on `:5173`, shows styled landing page
- Vite proxy forwards `/api/health` to server successfully

---

## Phase 2 — Database Layer (Event Sourcing Schema)

> [!NOTE]
> **Goal**: PostgreSQL schema deployed, migration runner working. Can insert/query events and users programmatically.

### Task 2.1 — Database Connection Pool
- [ ] Create `server/src/db/pool.js` — `pg.Pool` with connection from `DATABASE_URL`
- [ ] Connection health check on startup (verify connectivity, log success/failure)
- [ ] Graceful shutdown: `pool.end()` on `SIGTERM`/`SIGINT`

**File**: [server/src/db/pool.js](file:///d:/Projects/LIGMA/server/src/db/pool.js)

### Task 2.2 — Migration System
- [ ] Create `server/src/db/migrations/001_init.sql` — Full schema:
  - `users` — UUID PK, username, password_hash, display_name, color
  - `workspaces` — UUID PK, name, created_by
  - `workspace_roles` — RBAC junction table (lead/contributor/viewer)
  - `canvas_events` — Immutable event log with sequence numbers, JSONB payload, optional BYTEA Yjs update
  - `yjs_snapshots` — Binary Yjs doc snapshots with last sequence number
  - `tasks` — Extracted tasks linked to source canvas nodes
- [ ] Create `server/src/db/migrations/migrate.js` — Reads `*.sql` files in order, executes within transaction, tracks applied migrations in a `_migrations` table
- [ ] Add `npm run migrate` script to `server/package.json`

**Files**:
- [server/src/db/migrations/001_init.sql](file:///d:/Projects/LIGMA/server/src/db/migrations/001_init.sql)
- [server/src/db/migrations/migrate.js](file:///d:/Projects/LIGMA/server/src/db/migrations/migrate.js)

### ✅ Phase 2 Checkpoint
- `docker compose up` + `npm run migrate` creates all tables
- Can manually `INSERT` a user and query it back
- Event log accepts JSONB payloads with incrementing sequence numbers
- Indexes on `canvas_events(workspace_id, sequence_num)` verified

---

## Phase 3 — Authentication & Authorization

> [!NOTE]
> **Goal**: Users can register, login, and receive JWT tokens. Refresh token flow works via httpOnly cookies. RBAC middleware blocks unauthorized mutations.

### Task 3.1 — Auth Service
- [ ] Create `server/src/services/auth.service.js`:
  - `register(username, password, displayName)` — Hash with bcrypt, insert user, return user object
  - `login(username, password)` — Verify credentials, sign JWT access token (15min) + refresh token (7d)
  - `refresh(refreshToken)` — Verify refresh token, issue new access token
  - `logout()` — Clear refresh cookie

**File**: [server/src/services/auth.service.js](file:///d:/Projects/LIGMA/server/src/services/auth.service.js)

### Task 3.2 — Auth Middleware
- [ ] Create `server/src/middleware/auth.js`:
  - Extract `Bearer` token from `Authorization` header
  - Verify JWT, attach `req.user = { id, username }` to request
  - Support WebSocket auth via `socket.handshake.auth.token`

**File**: [server/src/middleware/auth.js](file:///d:/Projects/LIGMA/server/src/middleware/auth.js)

### Task 3.3 — Auth Routes
- [ ] Create `server/src/routes/auth.routes.js`:
  - `POST /api/auth/register` — Validate input, call auth service, set refresh cookie, return access token + user
  - `POST /api/auth/login` — Same flow with credential check
  - `POST /api/auth/refresh` — Read httpOnly cookie, return new access token
  - `POST /api/auth/logout` — Clear cookie
  - `GET /api/auth/me` — Return current user from token

**File**: [server/src/routes/auth.routes.js](file:///d:/Projects/LIGMA/server/src/routes/auth.routes.js)

### Task 3.4 — RBAC Middleware
- [ ] Create `server/src/middleware/rbac.js`:
  - `requireRole(...roles)` — Express middleware factory, checks `workspace_roles` for user
  - `checkNodePermission(action, nodeId, userId, workspaceId)` — Node-level permission check for WebSocket mutations
  - Permission matrix as defined in architecture (lead/contributor/viewer × create/edit/delete/move)

**File**: [server/src/middleware/rbac.js](file:///d:/Projects/LIGMA/server/src/middleware/rbac.js)

### Task 3.5 — Workspace Routes
- [ ] Create `server/src/services/workspace.service.js` — CRUD for workspaces, role management
- [ ] Create `server/src/routes/workspace.routes.js`:
  - `POST /api/workspaces` — Create workspace (creator becomes 'lead')
  - `GET /api/workspaces` — List user's workspaces
  - `GET /api/workspaces/:id` — Get workspace details + members
  - `POST /api/workspaces/:id/invite` — Invite user with role (lead only)
  - `PATCH /api/workspaces/:id/roles/:userId` — Change role (lead only)

**Files**:
- [server/src/services/workspace.service.js](file:///d:/Projects/LIGMA/server/src/services/workspace.service.js)
- [server/src/routes/workspace.routes.js](file:///d:/Projects/LIGMA/server/src/routes/workspace.routes.js)

### Task 3.6 — Auth UI (Frontend)
- [ ] Create `client/src/auth/AuthUI.js` — Login/Register forms
  - Glassmorphism card design on dark background
  - Form validation (username 3-50 chars, password 6+ chars)
  - Store access token in JS closure (not localStorage)
  - `setTimeout` auto-refresh at 14min mark
  - Redirect to workspace list on success
- [ ] Create `client/src/styles/auth.css`
- [ ] Create `client/src/net/api.js` — Fetch wrapper with auto `Authorization` header, auto-refresh on 401

**Files**:
- [client/src/auth/AuthUI.js](file:///d:/Projects/LIGMA/client/src/auth/AuthUI.js)
- [client/src/styles/auth.css](file:///d:/Projects/LIGMA/client/src/styles/auth.css)
- [client/src/net/api.js](file:///d:/Projects/LIGMA/client/src/net/api.js)

### ✅ Phase 3 Checkpoint
- Can register a new user, login, and receive tokens
- Access token expires at 15min, refresh via httpOnly cookie works
- Protected routes reject requests without valid token (401)
- RBAC: Workspace lead can invite users; viewer cannot create nodes (403)
- Auth UI renders with glassmorphism styling on dark background

---

## Phase 4 — Event Sourcing Service & WebSocket Gateway

> [!NOTE]
> **Goal**: WebSocket connections established. Canvas mutations persisted as events. Real-time broadcasting to room members. Reconnection replays missed events.

### Task 4.1 — Event Store Service
- [ ] Create `server/src/services/event.service.js`:
  - `appendEvent(workspaceId, userId, eventType, nodeId, payload, yjsUpdate)` — Insert event, return `{ id, sequence_num }`
  - `getEventsSince(workspaceId, sinceSequence)` — For reconnection replay
  - `getAllEvents(workspaceId)` — For time-travel
  - `createSnapshot(workspaceId, yjsStateVector)` — Store binary snapshot
  - `getLatestSnapshot(workspaceId)` — For initial hydration

**File**: [server/src/services/event.service.js](file:///d:/Projects/LIGMA/server/src/services/event.service.js)

### Task 4.2 — WebSocket Gateway
- [ ] Create `server/src/ws/gateway.js`:
  - Attach Socket.IO to HTTP server
  - Auth handshake: verify `socket.handshake.auth.token` via auth middleware
  - On connect: join `room:${workspaceId}`, broadcast `presence:join`
  - On disconnect: broadcast `presence:leave`, clean up tracking
  - Connection tracking map: `socketId → { userId, workspaceId, username, color }`

**File**: [server/src/ws/gateway.js](file:///d:/Projects/LIGMA/server/src/ws/gateway.js)

### Task 4.3 — WebSocket Message Handlers
- [ ] Create `server/src/ws/handlers.js`:
  - Route all `canvas:*` events through RBAC check
  - `canvas:node:create` → validate → append event → broadcast `canvas:delta`
  - `canvas:node:update` → validate ownership → append → broadcast
  - `canvas:node:move` → validate → append → broadcast
  - `canvas:node:delete` → validate (lead or own node) → append → broadcast
  - `canvas:draw:stroke` → validate → append → broadcast
  - `canvas:draw:erase` → validate → append → broadcast
  - `cursor:move` → broadcast to room (no persistence)
  - `reconnect` → fetch events since `lastSequenceNum` → emit `canvas:sync`

**File**: [server/src/ws/handlers.js](file:///d:/Projects/LIGMA/server/src/ws/handlers.js)

### Task 4.4 — Yjs Server Sync
- [ ] Create `server/src/ws/yjs-sync.js`:
  - In-memory `Map<workspaceId, Y.Doc>`
  - On first connection: hydrate from latest snapshot + replay subsequent events
  - On `yjs:update`: apply to server Y.Doc → append event → broadcast
  - Periodic snapshotting: every 50 updates OR 60 seconds (whichever first)
  - Cleanup: remove Y.Doc from memory when last user leaves workspace

**File**: [server/src/ws/yjs-sync.js](file:///d:/Projects/LIGMA/server/src/ws/yjs-sync.js)

### Task 4.5 — Socket.IO Client Setup
- [ ] Create `client/src/net/socket.js`:
  - Connect to server with `auth: { token }` handshake
  - Auto-reconnect with exponential backoff (Socket.IO built-in)
  - On reconnect: send `lastSequenceNum` from `sessionStorage`
  - Expose `emit()` and `on()` wrappers
  - Connection state indicator (connected/reconnecting/disconnected)

**File**: [client/src/net/socket.js](file:///d:/Projects/LIGMA/client/src/net/socket.js)

### Task 4.6 — Yjs Client Provider
- [ ] Create `client/src/net/yjs-provider.js`:
  - Bridge between local `Y.Doc` and Socket.IO transport
  - Send Y.Doc updates as `yjs:update` events
  - Apply incoming updates to local doc
  - Awareness protocol for cursor/presence metadata

**File**: [client/src/net/yjs-provider.js](file:///d:/Projects/LIGMA/client/src/net/yjs-provider.js)

### ✅ Phase 4 Checkpoint
- Two browser tabs connect to same workspace via WebSocket
- Events emitted from one tab appear in the other
- Server persists events to `canvas_events` table with incrementing sequence numbers
- Disconnect one tab → push events from other → reconnect first tab → missed events replayed
- Yjs snapshot created after 50 updates

---

## Phase 5 — Infinite Canvas (Core Frontend)

> [!NOTE]
> **Goal**: Working infinite canvas with pan, zoom, node CRUD, drawing, and real-time sync. This is the **largest phase**.

### Task 5.1 — Canvas Engine (Camera & Grid)
- [ ] Create `client/src/canvas/CanvasEngine.js`:
  - Camera state: `{ x, y, scale }` with smooth lerp interpolation
  - Pan: middle-click drag OR Space+left-drag, touch 2-finger drag
  - Zoom: scroll wheel / pinch, zooms toward cursor position (not center)
  - Coordinate transforms: `screenToWorld(sx, sy)` / `worldToScreen(wx, wy)`
  - Viewport bounds calculation for culling
  - Render loop: `requestAnimationFrame` driving grid + state updates
  - Grid: subtle dot pattern, spacing scales with zoom (e.g. 20px at 1x, 40px at 2x)
- [ ] Create `client/src/styles/canvas.css` — Canvas container, layers, toolbar

**Files**:
- [client/src/canvas/CanvasEngine.js](file:///d:/Projects/LIGMA/client/src/canvas/CanvasEngine.js)
- [client/src/styles/canvas.css](file:///d:/Projects/LIGMA/client/src/styles/canvas.css)

### Task 5.2 — Node Manager (Sticky Notes, Text, Shapes)
- [ ] Create `client/src/canvas/NodeManager.js`:
  - Node types: `sticky` (colored card), `text` (bare text block), `shape` (rect/circle/diamond)
  - Nodes rendered as DOM elements positioned via `transform: translate()` in world coords
  - Double-click to create node at cursor position (opens inline editor)
  - `contenteditable` text editing with Yjs binding per node
  - Drag-to-move with smooth animation (pointer events)
  - Selection: click to select, multi-select with Shift+click
  - Color picker for sticky notes (palette popup)
  - Node data model: `{ id, type, x, y, width, height, content, color, createdBy }`
  - Visual styles: rounded corners, drop shadows, subtle scale on hover

**File**: [client/src/canvas/NodeManager.js](file:///d:/Projects/LIGMA/client/src/canvas/NodeManager.js)

### Task 5.3 — Drawing Layer
- [ ] Create `client/src/canvas/DrawingLayer.js`:
  - Dedicated `<canvas>` element below DOM nodes, above grid
  - Pen tool: smooth freehand with `quadraticCurveTo()`, 2px width, user color
  - Marker tool: thick semi-transparent strokes, 8px, 50% opacity
  - Eraser: detect stroke bbox intersection, emit erase event
  - Point simplification: Ramer-Douglas-Peucker on `pointerup` (reduce 500+ → ~50 points)
  - Stroke storage synced via Yjs `Y.Array`
  - Zoom-aware rendering: all points in world coordinates, transformed by camera matrix
  - Performance: `requestAnimationFrame` batching, dirty-region clip-rect optimization

**File**: [client/src/canvas/DrawingLayer.js](file:///d:/Projects/LIGMA/client/src/canvas/DrawingLayer.js)

### Task 5.4 — Canvas Toolbar
- [ ] Add toolbar to canvas view:
  - **Tools**: Select (arrow), Sticky Note, Text, Shape (dropdown: rect/circle/diamond), Pen, Marker, Eraser
  - **Actions**: Undo, Redo, Zoom In, Zoom Out, Fit to Screen, Reset View
  - Glassmorphism floating toolbar, centered horizontally at top
  - Active tool highlighted with accent color
  - Keyboard shortcuts: `V` select, `S` sticky, `T` text, `P` pen, `E` eraser, `Ctrl+Z` undo, `Ctrl+Shift+Z` redo

*Implemented within*: [CanvasEngine.js](file:///d:/Projects/LIGMA/client/src/canvas/CanvasEngine.js) and [canvas.css](file:///d:/Projects/LIGMA/client/src/styles/canvas.css)

### Task 5.5 — Cursor Presence Layer
- [ ] Create `client/src/canvas/CursorLayer.js`:
  - Absolute-position cursor elements (colored dot + name label)
  - Smooth CSS transition movement (`transform: translate()`)
  - Throttled emission at 30fps via `requestAnimationFrame`
  - Fade out after 5s inactivity (CSS opacity transition)
  - Removed on `presence:leave` event

**File**: [client/src/canvas/CursorLayer.js](file:///d:/Projects/LIGMA/client/src/canvas/CursorLayer.js)

### Task 5.6 — State Management & Utilities
- [ ] Create `client/src/utils/state.js` — Simple reactive store (pub/sub pattern)
  - `createStore(initialState)` → `{ getState, setState, subscribe }`
  - Used for: current tool, auth state, workspace data, connection status
- [ ] Create `client/src/utils/helpers.js` — Utility functions:
  - `debounce()`, `throttle()`, `generateId()` (UUID v4)
  - `clamp()`, `lerp()`, `distance()` — Math helpers for canvas
  - Ramer-Douglas-Peucker point simplification algorithm

**Files**:
- [client/src/utils/state.js](file:///d:/Projects/LIGMA/client/src/utils/state.js)
- [client/src/utils/helpers.js](file:///d:/Projects/LIGMA/client/src/utils/helpers.js)

### Task 5.7 — Client Routing & Page Assembly
- [ ] Update `client/src/main.js` — Simple hash-based router:
  - `#/login` → Auth UI
  - `#/workspaces` → Workspace list (create/join)
  - `#/workspace/:id` → Canvas + Task Board view
  - Auth guard: redirect to `#/login` if no token
- [ ] Create workspace list page:
  - Card grid of user's workspaces
  - "Create Workspace" button with name input modal
  - Click workspace card → navigate to canvas

*Updated file*: [client/src/main.js](file:///d:/Projects/LIGMA/client/src/main.js)

### ✅ Phase 5 Checkpoint
- Can create, move, edit, and delete sticky notes on infinite canvas
- Pan/zoom works via mouse and keyboard
- Drawing with pen/marker works, strokes persist
- Two browser tabs show real-time sync (node changes + drawings appear)
- Remote cursors visible with names and colors
- Workspace list shows user's workspaces; click to enter canvas

---

## Phase 6 — AI Task Extraction & Task Board

> [!NOTE]
> **Goal**: AI automatically extracts tasks from sticky note text. Kanban board shows extracted tasks. Tasks link back to canvas nodes.

### Task 6.1 — AI Service (NLP Pipeline)
- [ ] Create `server/src/services/ai.service.js`:
  - Load `natural` BayesClassifier, train with labeled data
  - Create `server/src/services/ai-training-data.json` — ~400 examples (100 per intent: `action_item`, `decision`, `question`, `reference`)
  - Rule-based boosters: `?` → question, imperative verb → action_item, URL → reference, "decided"/"agreed" → decision
  - Hybrid scoring: `0.6 × bayesScore + 0.4 × boosterScore`
  - Confidence threshold: 0.6 (skip extraction if below)
  - Returns `{ intent, confidence, extractedTitle }`
  - Serialize trained classifier to JSON (cache on disk for fast restarts)

**Files**:
- [server/src/services/ai.service.js](file:///d:/Projects/LIGMA/server/src/services/ai.service.js)
- [server/src/services/ai-training-data.json](file:///d:/Projects/LIGMA/server/src/services/ai-training-data.json)

### Task 6.2 — Task Service & Routes
- [ ] Create `server/src/services/task.service.js`:
  - `extractAndSave(workspaceId, nodeId, text)` — Run AI pipeline, insert task if confidence ≥ threshold
  - `getByWorkspace(workspaceId)` — All tasks for kanban board
  - `updateStatus(taskId, status)` — Move between columns
  - `updateAssignee(taskId, assigneeId)` — Assign user
- [ ] Create `server/src/routes/task.routes.js`:
  - `GET /api/workspaces/:id/tasks` — List tasks
  - `PATCH /api/tasks/:id` — Update status/assignee
- [ ] Hook AI extraction into WebSocket handlers: trigger on `canvas:node:create` and `canvas:node:update` (debounced)

**Files**:
- [server/src/services/task.service.js](file:///d:/Projects/LIGMA/server/src/services/task.service.js)
- [server/src/routes/task.routes.js](file:///d:/Projects/LIGMA/server/src/routes/task.routes.js)

### Task 6.3 — Task Board UI
- [ ] Create `client/src/board/TaskBoard.js`:
  - Three-column Kanban: `TODO` | `In Progress` | `Done`
  - Drag-and-drop between columns (native Drag API)
  - Slide-in panel from right side of canvas view
  - Toggle with keyboard shortcut `B` or toolbar button
- [ ] Create `client/src/board/TaskCard.js`:
  - Card displays: title, intent badge (🎯/✅/❓/📎), assignee avatar, status
  - "Jump to Canvas" button → animate camera to source node + highlight pulse
  - Assignee dropdown (workspace members)
- [ ] Create `client/src/styles/board.css` — Kanban column layout, card styles, animations

**Files**:
- [client/src/board/TaskBoard.js](file:///d:/Projects/LIGMA/client/src/board/TaskBoard.js)
- [client/src/board/TaskCard.js](file:///d:/Projects/LIGMA/client/src/board/TaskCard.js)
- [client/src/styles/board.css](file:///d:/Projects/LIGMA/client/src/styles/board.css)

### Task 6.4 — Canvas ↔ Task Linking
- [ ] Canvas nodes with linked tasks show a small badge (intent icon)
- [ ] Clicking badge opens task details panel
- [ ] "Jump to Canvas" from task board: `CanvasEngine.animateTo(node.x, node.y, 1.0)` with easing + 2-second highlight pulse on the node

*Implemented across*: NodeManager.js, TaskBoard.js, CanvasEngine.js

### ✅ Phase 6 Checkpoint
- Create a sticky note with "Fix the login bug by Friday" → task auto-extracted as `action_item`
- Task appears in TODO column of kanban board
- Click "Jump to Canvas" on task → canvas pans and zooms to source node
- Drag task to "Done" column → status updates in DB
- AI correctly classifies questions (`?`), references (URLs), decisions ("decided:")

---

## Phase 7 — Time Travel & RBAC UI

> [!NOTE]
> **Goal**: Timeline slider replays canvas history. RBAC controls visible in UI with role badges and permission-gated controls.

### Task 7.1 — Time Travel Slider
- [ ] Create `client/src/canvas/TimeTravel.js`:
  - Horizontal slider at bottom of canvas (glassmorphism bar)
  - Fetches full event log via `GET /api/workspaces/:id/events`
  - Replay: apply events incrementally to a temporary `Y.Doc`
  - Canvas enters read-only mode during replay
  - Event metadata display: author name, timestamp, action type
  - Play/pause button for auto-advancing through events
  - **Keyboard shortcut**: `[` / `]` to step through events
- [ ] Add route: `GET /api/workspaces/:id/events` to `workspace.routes.js`

**File**: [client/src/canvas/TimeTravel.js](file:///d:/Projects/LIGMA/client/src/canvas/TimeTravel.js)

### Task 7.2 — RBAC UI Controls
- [ ] Members sidebar panel (slide from left):
  - List of workspace members with role badges (Lead 👑, Contributor ✏️, Viewer 👁️)
  - Lead can change roles via dropdown
  - Lead can invite new users (username input + role selector)
  - Online/offline status indicator per member
- [ ] Permission-gated UI:
  - Viewers: toolbar disabled, cursor changes to "not-allowed" on canvas, nodes not draggable
  - Contributors: can't delete others' nodes (delete button hidden for those)
  - Visual indicator of current user's role in the header

*Implemented across*: main.js (sidebar), canvas modules (permission checks)

### ✅ Phase 7 Checkpoint
- Time-travel slider replays canvas history frame by frame
- Read-only mode correctly prevents mutations during replay
- Viewer role: all edit controls disabled, server rejects mutation attempts
- Lead can change a contributor to viewer → UI updates immediately
- Members sidebar shows all workspace participants with roles

---

## Phase 8 — Polish, Performance & Deployment

> [!NOTE]
> **Goal**: Production-ready application deployed to Render with WebSocket support.

### Task 8.1 — Visual Polish
- [ ] Micro-animations:
  - Node creation: scale-in from 0.8 → 1.0 with spring easing
  - Task extraction: card slides from canvas node position to task board
  - Cursor transitions: smooth 150ms CSS transitions
  - Panel open/close: slide + fade
- [ ] Loading states: skeleton loaders for workspace list, task board
- [ ] Error states: toast notifications for connection errors, permission denials
- [ ] Empty states: helpful illustrations and prompts when no nodes/tasks exist

### Task 8.2 — Performance Optimization
- [ ] Canvas viewport culling: skip rendering/updating nodes outside visible bounds
- [ ] Drawing layer: dirty-region re-rendering (clip rect to changed area)
- [ ] Throttle cursor broadcasts to 30fps
- [ ] Debounce AI extraction (500ms after last node text change)
- [ ] Event log pagination for time-travel (load in chunks of 100)
- [ ] Yjs snapshot compression for large documents

### Task 8.3 — Responsive Design
- [ ] Mobile-friendly canvas controls (touch pan/zoom)
- [ ] Responsive task board (stacked columns on mobile)
- [ ] Auth forms centered and readable on all screen sizes
- [ ] Minimum viable mobile toolbar

### Task 8.4 — Deployment to Render
- [ ] Verify `render.yaml` Blueprint:
  - Web service: `server/` with `npm start`, health check on `/api/health`
  - Static site: `client/` with `npm run build`, publish from `dist/`
  - PostgreSQL addon: `ligma-db`
  - Environment variables: `DATABASE_URL` (auto from addon), `JWT_SECRET`, `CLIENT_URL`
- [ ] Test WebSocket `wss://` connectivity on Render
- [ ] Run migrations on Render's PostgreSQL instance
- [ ] Verify CORS config allows the Render static site URL
- [ ] Test with 3+ concurrent users

### ✅ Phase 8 Checkpoint
- All animations feel smooth and polished
- Canvas handles 100+ nodes without frame drops
- App deployed to Render and accessible via public URL
- WebSocket connections work over `wss://`
- 3+ users can collaborate simultaneously without conflicts

---

## Dependency Graph

```mermaid
graph LR
    P1[Phase 1: Scaffolding] --> P2[Phase 2: Database]
    P2 --> P3[Phase 3: Auth & RBAC]
    P2 --> P4[Phase 4: Events & WebSocket]
    P3 --> P4
    P4 --> P5[Phase 5: Infinite Canvas]
    P3 --> P5
    P5 --> P6[Phase 6: AI & Task Board]
    P4 --> P6
    P5 --> P7[Phase 7: Time Travel & RBAC UI]
    P6 --> P7
    P7 --> P8[Phase 8: Polish & Deploy]

    style P1 fill:#6366f1,color:#fff
    style P2 fill:#8b5cf6,color:#fff
    style P3 fill:#a78bfa,color:#fff
    style P4 fill:#06b6d4,color:#fff
    style P5 fill:#f59e0b,color:#fff
    style P6 fill:#10b981,color:#fff
    style P7 fill:#ec4899,color:#fff
    style P8 fill:#f43f5e,color:#fff
```

---

## Effort Estimates

| Phase | Description | Tasks | Estimated |
|-------|-------------|-------|-----------|
| **1** | Scaffolding & Config | 4 | ~30 min |
| **2** | Database Layer | 2 | ~30 min |
| **3** | Auth & RBAC | 6 | ~1.5 hr |
| **4** | Events & WebSocket | 6 | ~2 hr |
| **5** | Infinite Canvas | 7 | ~3 hr |
| **6** | AI & Task Board | 4 | ~2 hr |
| **7** | Time Travel & RBAC UI | 2 | ~1.5 hr |
| **8** | Polish & Deploy | 4 | ~1.5 hr |
| | **Total** | **35 tasks** | **~12 hr** |

> [!IMPORTANT]
> Estimates assume AI-assisted development. Actual time may vary based on debugging, iteration, and your feedback cycles.

---

## Decisions To Confirm

> [!WARNING]
> **Please confirm or adjust the following before we start building:**
> 1. **Frontend framework**: Vanilla JS + Vite (no React/Vue) — still OK?
> 2. **Phase order**: Want to start with Phase 1 → 2 → 3 sequentially, or skip ahead?
> 3. **Any scope changes** since the architecture conversation?
