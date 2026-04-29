const fs = require("fs/promises");
const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env"), override: false });
dotenv.config({ path: path.resolve(__dirname, "../../../.env"), override: false });

const TABLES = [
  {
    name: "users",
    orderBy: "created_at, id",
    sql: "SELECT id, username, display_name, color, created_at FROM users ORDER BY created_at, id",
  },
  {
    name: "workspaces",
    orderBy: "created_at, id",
    sql: "SELECT * FROM workspaces ORDER BY created_at, id",
  },
  {
    name: "workspace_roles",
    orderBy: "workspace_id, user_id",
    sql: "SELECT * FROM workspace_roles ORDER BY workspace_id, user_id",
  },
  {
    name: "canvas_events",
    orderBy: "workspace_id, sequence_num",
    sql: "SELECT * FROM canvas_events ORDER BY workspace_id, sequence_num",
  },
  {
    name: "yjs_snapshots",
    orderBy: "workspace_id, last_sequence_num, id",
    sql: "SELECT * FROM yjs_snapshots ORDER BY workspace_id, last_sequence_num, id",
  },
  {
    name: "tasks",
    orderBy: "workspace_id, created_at, id",
    sql: "SELECT * FROM tasks ORDER BY workspace_id, created_at, id",
  },
];

function encodeBuffers(value) {
  if (Buffer.isBuffer(value)) {
    return { encoding: "base64", data: value.toString("base64") };
  }

  if (Array.isArray(value)) {
    return value.map(encodeBuffers);
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, encodeBuffers(nestedValue)]),
    );
  }

  return value;
}

async function exportEventLog() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to export demo data.");
  }

  const outputDir = process.env.BACKUP_DIR || path.resolve(process.cwd(), "backups");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `ligma-event-log-${timestamp}.json`);
  const pool = new Pool({ connectionString });

  try {
    const tables = {};

    for (const table of TABLES) {
      const result = await pool.query(table.sql);
      tables[table.name] = {
        orderBy: table.orderBy,
        rowCount: result.rowCount,
        rows: result.rows.map(encodeBuffers),
      };
    }

    const backup = {
      exportedAt: new Date().toISOString(),
      database: "ligma",
      formatVersion: 1,
      tables,
    };

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(backup, null, 2)}\n`, "utf8");

    console.log(`Exported LIGMA demo data to ${outputPath}`);
    for (const table of TABLES) {
      console.log(`- ${table.name}: ${tables[table.name].rowCount} rows`);
    }
  } finally {
    await pool.end();
  }
}

exportEventLog().catch((error) => {
  console.error("Failed to export LIGMA demo data.");
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
