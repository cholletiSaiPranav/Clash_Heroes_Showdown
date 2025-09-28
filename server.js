

















const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: '*', // allow all origins; in production, set your frontend URL
    methods: ['GET', 'POST']
  }
});

// Serve static frontend files (index.html and assets)
app.use(express.static(path.join(__dirname, '.')));

// SPA fallback route middleware (must be AFTER static files)
app.use((req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

// ------------------------
// Socket.io Game Logic
// ------------------------
let rooms = {};

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('createRoom', (callback) => {
    const roomId = Math.random().toString(36).substring(7);
    rooms[roomId] = { host: socket.id, players: 1, choices: { p1: null, p2: null } };
    socket.join(roomId);
    callback(roomId);
  });

  socket.on('joinRoom', (roomId, callback) => {
    if (rooms[roomId] && rooms[roomId].players === 1) {
      socket.join(roomId);
      rooms[roomId].players = 2;
      callback(true);
    } else {
      callback(false);
    }
  });

  socket.on('choose', (charId) => {
    const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
    if (!roomId || !rooms[roomId]) return;

    const isHost = socket.id === rooms[roomId].host;
    if (isHost) rooms[roomId].choices.p1 = charId;
    else rooms[roomId].choices.p2 = charId;

    io.to(roomId).emit('playerChose', { player: isHost ? 1 : 2, charId });

    if (rooms[roomId].choices.p1 && rooms[roomId].choices.p2) {
      io.in(roomId).fetchSockets().then((sockets) => {
        sockets.forEach((s) => {
          const pn = s.id === rooms[roomId].host ? 1 : 2;
          s.emit('gameStart', {
            playerNum: pn,
            p1Char: rooms[roomId].choices.p1,
            p2Char: rooms[roomId].choices.p2,
          });
        });
      });
    }
  });

  socket.on('input', (data) => {
    const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
    if (roomId) {
      socket.to(roomId).emit('remoteInput', data);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// ------------------------
// Start Server (Render compatible)
// ------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));








