const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for simplicity; restrict in production
  }
});

let rooms = {};

io.on('connection', (socket) => {
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
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running on port ${port}`));