const { pool } = require('../server/src/db/pool');

async function listCols() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks'");
    console.log("Columns:", res.rows.map(c => c.column_name));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

listCols();
