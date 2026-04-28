const { pool } = require('../db/pool');

async function listUserTasks(userId) {
  const result = await pool.query(
    `SELECT t.*, u.display_name as "authorName", w.name as "workspaceName"
     FROM tasks t
     JOIN workspaces w ON t.workspace_id = w.id
     JOIN workspace_members wm ON w.id = wm.workspace_id
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE wm.user_id = $1
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
  const { title, status = 'todo', priority = 'medium', sourceNodeId = null, assigneeId = null } = data;
  const result = await pool.query(
    `INSERT INTO tasks (workspace_id, title, status, priority, source_node_id, assignee_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [workspaceId, title, status, priority, sourceNodeId, assigneeId]
  );
  return result.rows[0];
}

async function updateTask(taskId, data) {
  const fields = [];
  const values = [];
  let i = 1;

  if (data.status) {
    fields.push(`status = $${i++}`);
    values.push(data.status);
  }
  if (data.priority) {
    fields.push(`priority = $${i++}`);
    values.push(data.priority);
  }

  if (fields.length === 0) return null;

  values.push(taskId);
  const query = `UPDATE tasks SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`;
  
  const result = await pool.query(query, values);
  return result.rows[0];
}

module.exports = {
  listWorkspaceTasks,
  listUserTasks,
  createTask,
  updateTask,
};
