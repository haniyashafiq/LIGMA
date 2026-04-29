const { pool } = require('../db/pool');

const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
/** DB constraint (003_refactor_tasks): todo, doing, done, in_progress — we canonicalize to in_progress vs doing */
const VALID_STATUSES = new Set(['todo', 'doing', 'done', 'in_progress']);

function normalizeTitleText(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim();
}

function normalizeComparableTitle(raw) {
  return normalizeTitleText(raw).replace(/\s+/g, ' ').toLowerCase();
}

/** AI + UI may send \"doing\"; store as in_progress everywhere. */
function normalizeStatusForStorage(raw) {
  const s = String(raw || 'todo')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (s === 'doing') return 'in_progress';
  if (VALID_STATUSES.has(s)) return s;
  return 'todo';
}

function normalizePriority(raw) {
  const p = String(raw || 'medium')
    .trim()
    .toLowerCase();
  return VALID_PRIORITIES.has(p) ? p : 'medium';
}

function DuplicateTaskError() {
  const e = new Error('A task with this title already exists for you in this workspace.');
  e.code = 'DUPLICATE_TASK';
  e.statusCode = 409;
  return e;
}

async function findDuplicateTaskForUser(workspaceId, sourceAuthorId, comparableTitle) {
  if (!sourceAuthorId || !comparableTitle) return null;
  const result = await pool.query(
    `SELECT id FROM tasks 
     WHERE workspace_id = $1 AND source_author_id = $2 
       AND LOWER(TRIM(REGEXP_REPLACE(title, '\\s+', ' ', 'g'))) = $3 
     LIMIT 1`,
    [workspaceId, sourceAuthorId, comparableTitle]
  );
  return result.rows[0] || null;
}

/**
 * Minimal row used by socket handlers for incremental UI refresh.
 */
function buildTaskSyncPayload(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    intent: row.intent,
    sourceNodeId: row.source_node_id,
    source_node_id: row.source_node_id,
    authorName: row.authorName || row.source_author_name || null,
  };
}

async function listUserTasks(userId) {
  const result = await pool.query(
    `SELECT
       t.*,
       COALESCE(t.source_author_name, source_user.display_name, source_user.username, assignee.display_name, assignee.username) as "authorName",
       w.name as "workspaceName"
     FROM tasks t
     JOIN workspaces w ON t.workspace_id = w.id
     JOIN workspace_roles wr ON w.id = wr.workspace_id
     LEFT JOIN users assignee ON t.assignee_id = assignee.id
     LEFT JOIN users source_user ON t.source_author_id = source_user.id
     WHERE wr.user_id = $1
     ORDER BY t.created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function listWorkspaceTasks(workspaceId) {
  const result = await pool.query(
    `SELECT
       t.*,
       COALESCE(t.source_author_name, source_user.display_name, source_user.username, assignee.display_name, assignee.username) as "authorName"
     FROM tasks t
     LEFT JOIN users assignee ON t.assignee_id = assignee.id
     LEFT JOIN users source_user ON t.source_author_id = source_user.id
     WHERE t.workspace_id = $1
     ORDER BY t.created_at DESC`,
    [workspaceId]
  );
  return result.rows;
}

async function createTask(workspaceId, data) {
  const titleText = normalizeTitleText(data.title);
  if (!titleText) {
    const e = new Error('Title is required.');
    e.statusCode = 400;
    throw e;
  }

  const status = normalizeStatusForStorage(data.status);
  const priority = normalizePriority(data.priority);
  const sourceNodeId = data.sourceNodeId != null ? data.sourceNodeId : null;
  const assigneeId = data.assigneeId != null ? data.assigneeId : null;
  const source = data.source != null ? data.source : null;
  const intent = data.intent != null ? data.intent : null;
  const sourceAuthorId = data.sourceAuthorId != null ? data.sourceAuthorId : null;
  const sourceAuthorName =
    typeof data.sourceAuthorName === 'string' ? data.sourceAuthorName : null;

  const comparableTitle = normalizeComparableTitle(titleText);
  if (sourceAuthorId) {
    const dup = await findDuplicateTaskForUser(workspaceId, sourceAuthorId, comparableTitle);
    if (dup) {
      throw DuplicateTaskError();
    }
  }

  const result = await pool.query(
    `INSERT INTO tasks (
       workspace_id,
       title,
       status,
       priority,
       source_node_id,
       assignee_id,
       source,
       intent,
       source_author_id,
       source_author_name
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      workspaceId,
      titleText,
      status,
      priority,
      sourceNodeId,
      assigneeId,
      source,
      intent,
      sourceAuthorId,
      sourceAuthorName,
    ]
  );
  return result.rows[0];
}

async function getTask(workspaceId, taskId) {
  const result = await pool.query(
    `SELECT * FROM tasks WHERE workspace_id = $1 AND id = $2 LIMIT 1`,
    [workspaceId, taskId]
  );
  return result.rows[0] || null;
}

async function deleteTaskByNodeId(workspaceId, sourceNodeId) {
  const result = await pool.query(
    `DELETE FROM tasks WHERE workspace_id = $1 AND source_node_id = $2 RETURNING *`,
    [workspaceId, sourceNodeId]
  );
  return result.rows;
}

async function updateTaskStatus(workspaceId, taskId, status) {
  const result = await pool.query(
    `UPDATE tasks SET status = $1, updated_at = NOW() WHERE workspace_id = $2 AND id = $3 RETURNING *`,
    [status, workspaceId, taskId]
  );
  return result.rows[0];
}

async function upsertTaskByNodeId(workspaceId, sourceNodeId, data) {
  const titleText = normalizeTitleText(data.title);
  if (!titleText) {
    const e = new Error('Title is required.');
    e.statusCode = 400;
    throw e;
  }

  const title = titleText;
  const status = normalizeStatusForStorage(data.status);
  const priority = normalizePriority(data.priority);
  const assigneeId = data.assigneeId != null ? data.assigneeId : null;
  const source = data.source !== undefined ? data.source : 'ai';
  const intent = data.intent != null ? data.intent : null;
  const sourceAuthorId = data.sourceAuthorId != null ? data.sourceAuthorId : null;
  const sourceAuthorName =
    typeof data.sourceAuthorName === 'string' ? data.sourceAuthorName : null;

  const comparableTitle = normalizeComparableTitle(title);

  // 1. Task already linked to this node → update.
  const existingByNode = await pool.query(
    `SELECT id FROM tasks WHERE workspace_id = $1 AND source_node_id = $2`,
    [workspaceId, sourceNodeId]
  );

  if (existingByNode.rows.length > 0) {
    const result = await pool.query(
      `UPDATE tasks
       SET title = $1,
           status = COALESCE($2, status),
           priority = COALESCE($3, priority),
           assignee_id = COALESCE($4, assignee_id),
           source = COALESCE($5, source),
           intent = COALESCE($6, intent),
           source_author_id = COALESCE($7, source_author_id),
           source_author_name = COALESCE($8, source_author_name),
           updated_at = NOW()
       WHERE workspace_id = $9 AND source_node_id = $10
       RETURNING *`,
      [
        title,
        status,
        priority,
        assigneeId,
        source,
        intent,
        sourceAuthorId,
        sourceAuthorName,
        workspaceId,
        sourceNodeId,
      ]
    );
    return result.rows[0];
  }

  // 2. Same user + same normalized title in workspace → reuse row, attach this node (no duplicate row).
  if (sourceAuthorId) {
    const existingByAuthorTitle = await pool.query(
      `SELECT id, source_node_id FROM tasks 
       WHERE workspace_id = $1 AND source_author_id = $2 
         AND LOWER(TRIM(REGEXP_REPLACE(title, '\\s+', ' ', 'g'))) = $3 
       LIMIT 1`,
      [workspaceId, sourceAuthorId, comparableTitle]
    );
    if (existingByAuthorTitle.rows.length > 0) {
      const taskId = existingByAuthorTitle.rows[0].id;
      const result = await pool.query(
        `UPDATE tasks
         SET title = $1,
             status = COALESCE($2, status),
             priority = COALESCE($3, priority),
             assignee_id = COALESCE($4, assignee_id),
             source = COALESCE($5, source),
             intent = COALESCE($6, intent),
             source_node_id = $7,
             updated_at = NOW()
         WHERE id = $8
         RETURNING *`,
        [title, status, priority, assigneeId, source, intent, sourceNodeId, taskId]
      );
      return result.rows[0];
    }
  }

  return createTask(workspaceId, {
    title,
    status,
    priority,
    sourceNodeId,
    assigneeId,
    source,
    intent,
    sourceAuthorId,
    sourceAuthorName,
  });
}

async function updateTask(workspaceId, taskId, data) {
  const fields = [];
  const values = [];
  let i = 1;

  if (data.title !== undefined && data.title !== null) {
    const t = normalizeTitleText(data.title);
    if (!t) {
      const e = new Error('Title cannot be empty.');
      e.statusCode = 400;
      throw e;
    }
    fields.push(`title = $${i++}`);
    values.push(t);

    const row = await getTask(workspaceId, taskId);
    if (row?.source_author_id) {
      const comparableTitle = normalizeComparableTitle(t);
      const dup = await findDuplicateTaskForUser(workspaceId, row.source_author_id, comparableTitle);
      if (dup && String(dup.id) !== String(taskId)) {
        throw DuplicateTaskError();
      }
    }
  }

  if (data.status !== undefined && data.status !== null) {
    fields.push(`status = $${i++}`);
    values.push(normalizeStatusForStorage(data.status));
  }
  if (data.priority !== undefined && data.priority !== null) {
    fields.push(`priority = $${i++}`);
    values.push(normalizePriority(data.priority));
  }
  if (data.intent !== undefined && data.intent !== null) {
    fields.push(`intent = $${i++}`);
    values.push(data.intent);
  }

  if (fields.length === 0) return null;

  values.push(workspaceId, taskId);
  const query = `UPDATE tasks SET ${fields.join(', ')}, updated_at = NOW() WHERE workspace_id = $${i++} AND id = $${i} RETURNING *`;
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function deleteTask(workspaceId, taskId) {
  const result = await pool.query(
    `DELETE FROM tasks WHERE workspace_id = $1 AND id = $2 RETURNING *`,
    [workspaceId, taskId]
  );
  return result.rows[0];
}

async function deleteAllTasks(workspaceId) {
  const result = await pool.query(`DELETE FROM tasks WHERE workspace_id = $1 RETURNING *`, [
    workspaceId,
  ]);
  return result.rows;
}

module.exports = {
  listWorkspaceTasks,
  listUserTasks,
  getTask,
  createTask,
  deleteTaskByNodeId,
  updateTaskStatus,
  upsertTaskByNodeId,
  deleteTask,
  deleteAllTasks,
  updateTask,
  normalizeStatusForStorage,
  normalizePriority,
  buildTaskSyncPayload,
  DuplicateTaskError,
};
