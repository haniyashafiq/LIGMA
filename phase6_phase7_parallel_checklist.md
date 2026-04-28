# Phase 6 & Phase 7 Parallel Work Checklist

Reference plan: `implementation_plan_ligma_tasks.md`

Use this checklist when one teammate owns **Phase 6** and the other owns **Phase 7** on separate branches.

---

## Phase 6 Owner Checklist

### Task 6.1 — AI Service (NLP Pipeline)

- [ ] Implement `server/src/services/ai.service.js`
- [ ] Return stable shape: `{ intent, confidence, extractedTitle }`
- [ ] Enforce confidence threshold behavior (`>= 0.6` creates task, below skips)
- [ ] Keep intent enum stable: `action_item | decision | question | reference`

### Task 6.2 — Task Service & Routes

- [ ] Implement `server/src/services/task.service.js`
  - [ ] `extractAndSave(workspaceId, nodeId, text)`
  - [ ] `getByWorkspace(workspaceId)`
  - [ ] `updateStatus(taskId, status)`
  - [ ] `updateAssignee(taskId, assigneeId)`
- [ ] Implement `server/src/routes/task.routes.js`
  - [ ] `GET /api/workspaces/:id/tasks`
  - [ ] `PATCH /api/tasks/:id`
- [ ] Wire routes in server app bootstrap
- [ ] Hook extraction trigger into canvas mutation flow (`create/update` node text path)

### Task 6.3 — Task Board UI

- [ ] Implement `client/src/board/TaskBoard.jsx`
  - [ ] Load tasks on mount
  - [ ] Render 3-column Kanban
  - [ ] Handle loading/empty/error states
- [ ] Implement `client/src/board/TaskCard.jsx`
  - [ ] Render `title`, `intent`, `status`, assignee
  - [ ] Expose `Jump to Canvas` via `jumpToNode(sourceNodeId)`
- [ ] Update `client/src/styles/board.css`
- [ ] If using DnD, ensure status updates persist after drag

### Task 6.4 — Canvas <-> Task Linking

- [ ] Add task badge/intent indicator to linked nodes
- [ ] Add task details interaction from node badge
- [ ] Verify task-to-canvas jump centers and highlights target node

### Phase 6 Verification

- [ ] Sticky note text can auto-extract task
- [ ] Task persists in DB and appears in board
- [ ] Status/assignee updates round-trip to server
- [ ] Task board remains functional after refresh/reconnect

---

## Phase 7 Owner Checklist

### Task 7.1 — Time Travel Slider

- [ ] Implement `client/src/canvas/TimeTravel.jsx`
- [ ] Fetch event log via REST using adapter (do not couple UI to raw backend payload)
- [ ] Replay to **separate** tldraw store instance
- [ ] Render replay in read-only mode
- [ ] Add slider + play/pause + current frame indicator
- [ ] Handle missing/empty events gracefully (no crash)

### Task 7.2 — RBAC UI Controls

- [ ] Implement `client/src/workspace/MembersSidebar.jsx`
- [ ] Implement `client/src/workspace/RoleBadge.jsx`
- [ ] Render members with role badge + online/offline indicator
- [ ] Role-gate UI affordances:
  - [ ] Viewer: no edit affordances
  - [ ] Contributor: cannot delete others' nodes
  - [ ] Lead: invite + role change controls
- [ ] Surface current user role in workspace UI
- [ ] Show clear feedback when server rejects mutation

### Phase 7 Verification

- [ ] Time-travel replay is deterministic for same event set
- [ ] Replay mode blocks editing
- [ ] Members list + role badges render correctly
- [ ] Permission-gated controls change correctly by role

---

## Shared Contract Checklist (Phase 6 <-> Phase 7)

- [ ] Freeze contract version in both PRs (example: `contract-v1`)
- [ ] Keep these response shapes stable until both PRs merge:
  - [ ] `GET /api/auth/me` -> `user.id`, `user.username`
  - [ ] `GET /api/workspaces/:id` -> `workspace.role` + `members[]`
  - [ ] `GET /api/workspaces/:id/tasks` -> `tasks[]` with `sourceNodeId`, `intent`, `status`
  - [ ] Events endpoint for replay -> ordered `sequenceNum`, `eventType`, `payload`, `createdAt`
- [ ] Document socket events used by task board/time travel (if any)
- [ ] Treat server authorization as source of truth; client gating is UX only

---

## Shared Merge-Safety Checklist

- [ ] Assign file ownership up front
- [ ] Keep shared integration files (`WorkspacePage`, `CanvasView`, `AppContext`) to additive edits only
- [ ] Avoid unrelated refactors in feature branches
- [ ] Rebase both branches frequently onto latest `main`
- [ ] Merge one branch first, rebase the other, then do one small integration pass
- [ ] Run full app smoke tests after final rebase

