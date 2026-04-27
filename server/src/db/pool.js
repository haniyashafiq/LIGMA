const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

let shutdownHooksRegistered = false;

async function checkDatabaseConnection() {
  const client = await pool.connect();

  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

async function closePool() {
  await pool.end();
}

function registerPoolShutdownHooks() {
  if (shutdownHooksRegistered) {
    return;
  }

  const shutdown = async (signal) => {
    try {
      console.log(`${signal} received. Closing database pool...`);
      await closePool();
      console.log('Database pool closed.');
      process.exit(0);
    } catch (error) {
      console.error('Failed to close database pool cleanly.');
      console.error(error.message);
      process.exit(1);
    }
  };

  process.once('SIGINT', () => {
    shutdown('SIGINT');
  });

  process.once('SIGTERM', () => {
    shutdown('SIGTERM');
  });

  shutdownHooksRegistered = true;
}

module.exports = {
  pool,
  checkDatabaseConnection,
  closePool,
  registerPoolShutdownHooks,
};
