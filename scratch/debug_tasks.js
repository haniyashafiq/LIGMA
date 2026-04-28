const { pool } = require('./server/src/db/pool');

async function debug() {
  const userId = '16a3f12c-0e7b-402b-84a5-60b777a166be'; // Example ID from logs if possible, or I'll just check all tasks
  try {
    const tasks = await pool.query('SELECT * FROM tasks');
    console.log('Total tasks in DB:', tasks.rowCount);
    console.log('Task samples:', tasks.rows);
    
    const members = await pool.query('SELECT * FROM workspace_members');
    console.log('Total members in DB:', members.rowCount);
    
    const result = await pool.query(
      `SELECT t.*, w.name as "workspaceName"
       FROM tasks t
       JOIN workspaces w ON t.workspace_id = w.id
       JOIN workspace_members wm ON w.id = wm.workspace_id
       WHERE wm.user_id = $1`,
      [userId]
    );
    console.log('Tasks for user:', result.rowCount);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

debug();
