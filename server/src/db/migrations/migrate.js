const fs = require('fs/promises');
const path = require('path');
const { pool, checkDatabaseConnection, closePool } = require('../pool');

const MIGRATIONS_TABLE = '_migrations';
const migrationsDir = __dirname;

async function ensureMigrationsTable() {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
			name TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`);
}

async function listMigrationFiles() {
	const entries = await fs.readdir(migrationsDir, { withFileTypes: true });

	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b));
}

async function getAppliedMigrations() {
	const result = await pool.query(
		`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY applied_at ASC, name ASC`
	);

	return new Set(result.rows.map((row) => row.name));
}

async function applyMigration(migrationName) {
	const migrationPath = path.join(migrationsDir, migrationName);
	const sql = await fs.readFile(migrationPath, 'utf8');
	const client = await pool.connect();

	try {
		await client.query('BEGIN');
		await client.query(sql);
		await client.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [
			migrationName,
		]);
		await client.query('COMMIT');
		console.log(`Applied migration: ${migrationName}`);
	} catch (error) {
		await client.query('ROLLBACK');
		throw new Error(`Failed migration ${migrationName}: ${error.message}`);
	} finally {
		client.release();
	}
}

async function migrate() {
	await checkDatabaseConnection();
	await ensureMigrationsTable();

	const migrationFiles = await listMigrationFiles();

	if (migrationFiles.length === 0) {
		console.log('No SQL migration files found.');
		return;
	}

	const appliedMigrations = await getAppliedMigrations();
	const pendingMigrations = migrationFiles.filter(
		(name) => !appliedMigrations.has(name)
	);

	if (pendingMigrations.length === 0) {
		console.log('No pending migrations. Database is up to date.');
		return;
	}

	for (const migrationName of pendingMigrations) {
		await applyMigration(migrationName);
	}

	console.log(
		`Migration complete. Applied ${pendingMigrations.length} migration(s).`
	);
}

migrate()
	.catch((error) => {
		console.error('Migration run failed.');
		console.error(error.message);
		process.exitCode = 1;
	})
	.finally(async () => {
		await closePool().catch(() => {});
	});
