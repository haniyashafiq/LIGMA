const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const config = require('./config');
const authRoutes = require('./routes/auth.routes');
const workspaceRoutes = require('./routes/workspace.routes');
const {
  checkDatabaseConnection,
  closePool,
  registerPoolShutdownHooks,
} = require('./db/pool');

const app = express();
let dbConnected = false;

app.use(
  cors({
    origin: config.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'ligma-server',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.CLIENT_URL,
    credentials: true,
  },
});

io.on('connection', (socket) => {
  socket.emit('server:ready', {
    message: 'Socket connected',
    socketId: socket.id,
  });
});

function getSanitizedDatabaseTarget(connectionString) {
  try {
    const parsed = new URL(connectionString);
    const databaseName = parsed.pathname.replace(/^\/+/, '') || '(default)';

    return {
      host: parsed.hostname || '(unknown)',
      port: parsed.port || '5432',
      database: databaseName,
    };
  } catch (_error) {
    return null;
  }
}

async function verifyDatabaseConnection() {
  await checkDatabaseConnection();
  dbConnected = true;
}

function logDatabaseStartupError(error) {
  console.error('Database connectivity check failed. Server will not start.');
  console.error(error.message);

  if (error.message.includes('password authentication failed')) {
    console.error(
      'Detected a DB credential mismatch. Ensure DATABASE_URL password matches the running Postgres instance.'
    );
    console.error(
      'If Postgres is running via Docker with persisted data, recreate it with: docker compose down -v && docker compose up -d'
    );
  }
}

async function startServer() {
  try {
    const dbTarget = getSanitizedDatabaseTarget(config.DATABASE_URL);
    if (dbTarget) {
      console.log(
        `Database target: host=${dbTarget.host} port=${dbTarget.port} database=${dbTarget.database}`
      );
    } else {
      console.log('Database target: unable to parse DATABASE_URL');
    }

    registerPoolShutdownHooks();
    await verifyDatabaseConnection();
    console.log('Database connectivity check passed.');

    server.listen(config.PORT, () => {
      console.log(`LIGMA server listening on http://localhost:${config.PORT}`);
    });
  } catch (error) {
    logDatabaseStartupError(error);
    await closePool().catch(() => {});
    process.exit(1);
  }
}

startServer();
