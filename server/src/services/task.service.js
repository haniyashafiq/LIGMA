const { pool } = require('../db/pool');

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
  const {
    title,
    status = 'todo',
    priority = 'medium',
    sourceNodeId = null,
    assigneeId = null,
    source = null,
    intent = null,
    sourceAuthorId = null,
    sourceAuthorName = null,
  } = data;
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
      title,
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
  const {
    title,
    status = 'todo',
    priority = 'medium',
    assigneeId = null,
    source = 'ai',
    intent = null,
    sourceAuthorId = null,
    sourceAuthorName = null,
  } = data;

  // 1. Check if a task is already linked to THIS specific node
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

  // 2. Duplication Constraint: Check if a task with the SAME TITLE already exists in this workspace
  // We trim and case-insensitively compare the title.
  const existingByTitle = await pool.query(
    `SELECT id, source_node_id FROM tasks 
     WHERE workspace_id = $1 AND LOWER(TRIM(title)) = LOWER(TRIM($2)) 
     LIMIT 1`,
    [workspaceId, title]
  );

  if (existingByTitle.rows.length > 0) {
    const taskId = existingByTitle.rows[0].id;
    const currentSourceNode = existingByTitle.rows[0].source_node_id;

    // If it exists, we update it but preserve the original source_node_id if it had one.
    // This effectively "merges" the new note's intent into the existing task.
    const result = await pool.query(
      `UPDATE tasks
       SET status = COALESCE($1, status),
           priority = COALESCE($2, priority),
           source_node_id = COALESCE(source_node_id, $3),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, priority, sourceNodeId, taskId]
    );
    return result.rows[0];
  }

  // 3. No existing task found, create a new one
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

  if (data.title) {
    fields.push(`title = $${i++}`);
    values.push(data.title);
  }
  if (data.status) {
    fields.push(`status = $${i++}`);
    values.push(data.status);
  }
  if (data.priority) {
    fields.push(`priority = $${i++}`);
    values.push(data.priority);
  }
  if (data.intent) {
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
  const result = await pool.query(
    `DELETE FROM tasks WHERE workspace_id = $1 RETURNING *`,
    [workspaceId]
  );
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
};
