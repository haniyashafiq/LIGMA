const { pool } = require('../db/pool');

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
  const { title, intent, sourceNodeId, assigneeId } = data;
  const result = await pool.query(
    `INSERT INTO tasks (workspace_id, title, intent, source_node_id, assignee_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [workspaceId, title, intent, sourceNodeId, assigneeId]
  );
  return result.rows[0];
}

async function updateTaskStatus(taskId, status) {
  const result = await pool.query(
    `UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, taskId]
  );
  return result.rows[0];
}

module.exports = {
  listWorkspaceTasks,
  createTask,
  updateTaskStatus,
};
