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
  const { title, status = 'todo', sourceNodeId = null, assigneeId = null, source = 'manual' } = data;
  const result = await pool.query(
    `INSERT INTO tasks (workspace_id, title, status, source_node_id, assignee_id, source)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [workspaceId, title, status, sourceNodeId, assigneeId, source]
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

async function updateTaskStatus(taskId, status) {
  const result = await pool.query(
    `UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, taskId]
  );
  return result.rows[0];
}

async function upsertTaskByNodeId(workspaceId, sourceNodeId, data) {
  const { title, status = 'todo', assigneeId = null, source = 'ai' } = data;
  
  const existing = await pool.query(
    `SELECT id FROM tasks WHERE workspace_id = $1 AND source_node_id = $2`,
    [workspaceId, sourceNodeId]
  );

  if (existing.rows.length > 0) {
    const result = await pool.query(
      `UPDATE tasks 
       SET title = $1, updated_at = NOW() 
       WHERE workspace_id = $2 AND source_node_id = $3 
       RETURNING *`,
      [title, workspaceId, sourceNodeId]
    );
    return result.rows[0];
  } else {
    return createTask(workspaceId, { title, status, sourceNodeId, assigneeId, source });
  }
}

async function deleteTask(workspaceId, taskId) {
  const result = await pool.query(
    `DELETE FROM tasks WHERE workspace_id = $1 AND id = $2 RETURNING *`,
    [workspaceId, taskId]
  );
  return result.rows[0];
}

async function updateTask(workspaceId, taskId, data) {
  const { title, status } = data;
  const result = await pool.query(
    `UPDATE tasks 
     SET title = COALESCE($1, title), 
         status = COALESCE($2, status), 
         updated_at = NOW() 
     WHERE workspace_id = $3 AND id = $4 
     RETURNING *`,
    [title, status, workspaceId, taskId]
  );
  return result.rows[0];
}

module.exports = {
  listWorkspaceTasks,
  createTask,
  deleteTaskByNodeId,
  updateTaskStatus,
  upsertTaskByNodeId,
  deleteTask,
  updateTask,
};
