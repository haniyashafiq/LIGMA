const { pool } = require('../server/src/db/pool');
async function checkTable() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks'");
    console.log(JSON.stringify(res.rows));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkTable();
