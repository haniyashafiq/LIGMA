const { pool } = require('../db/pool');

async function listUserTasks(userId) {
  const result = await pool.query(
    `SELECT t.*, u.display_name as "authorName", w.name as "workspaceName"
     FROM tasks t
     JOIN workspaces w ON t.workspace_id = w.id
     JOIN workspace_roles wr ON w.id = wr.workspace_id
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE wr.user_id = $1
     ORDER BY t.created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function listWorkspaceTasks(workspaceId) {
  const result = await pool.query(
    `SELECT t.*, u.display_name as "authorName" 
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
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
  } = data;
  const result = await pool.query(
    `INSERT INTO tasks (workspace_id, title, status, priority, source_node_id, assignee_id, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [workspaceId, title, status, priority, sourceNodeId, assigneeId, source]
  );
  return result.rows[0];
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
  } = data;

  const existing = await pool.query(
    `SELECT id FROM tasks WHERE workspace_id = $1 AND source_node_id = $2`,
    [workspaceId, sourceNodeId]
  );

  if (existing.rows.length > 0) {
    const result = await pool.query(
      `UPDATE tasks
       SET title = $1,
           status = COALESCE($2, status),
           priority = COALESCE($3, priority),
           assignee_id = COALESCE($4, assignee_id),
           source = COALESCE($5, source),
           updated_at = NOW()
       WHERE workspace_id = $6 AND source_node_id = $7
       RETURNING *`,
      [title, status, priority, assigneeId, source, workspaceId, sourceNodeId]
    );
    return result.rows[0];
  }

  return createTask(workspaceId, {
    title,
    status,
    priority,
    sourceNodeId,
    assigneeId,
    source,
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

module.exports = {
  listWorkspaceTasks,
  listUserTasks,
  createTask,
  deleteTaskByNodeId,
  updateTaskStatus,
  upsertTaskByNodeId,
  deleteTask,
  updateTask,
};
