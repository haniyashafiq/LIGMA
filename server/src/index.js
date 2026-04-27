const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const config = require('./config');

const app = express();

app.use(
  cors({
    origin: config.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'ligma-server',
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

server.listen(config.PORT, () => {
  console.log(`LIGMA server listening on http://localhost:${config.PORT}`);
});
