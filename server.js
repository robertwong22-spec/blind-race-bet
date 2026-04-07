const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// ---- Change this password to whatever you like ----
const ADMIN_PASSWORD = '111111aa';
// ---------------------------------------------------

let bets = {};
let targetPlayers = 0;
let gameStarted = false;
let currentRaceName = '';
let history = [];
let raceCounter = 0;

io.on('connection', (socket) => {
  const count = Object.keys(bets).length;
  const revealed = gameStarted && count >= targetPlayers && targetPlayers > 0;
  socket.emit('state', {
    betCount: count,
    target: targetPlayers,
    gameStarted,
    revealed,
    bets: revealed ? bets : null,
    raceName: currentRaceName,
    raceCounter,
    history
  });

  socket.on('setPlayers', (num) => {
    console.log('RAW INPUT:', num);
    targetPlayers = Math.min(Math.max(parseInt(num) || 3, 2), 4);
    console.log('CLAMPED TO:', targetPlayers);
    gameStarted = true;
    bets = {};
    raceCounter++;
    io.emit('nameRound', { target: targetPlayers, raceCounter });
  });

  socket.on('setRaceName', (name) => {
    currentRaceName = name;
    
    // Parse the race number if the name matches "R" followed by a number
    // This handles corrections like changing "R6" to "R8"
    const match = name.match(/^R(\d+)$/i);
    if (match) {
      const raceNum = parseInt(match[1], 10);
      if (!isNaN(raceNum)) {
        raceCounter = raceNum;  // Update counter to match the corrected value
        console.log('Race counter updated to:', raceCounter);
      }
    }
    
    bets = {};
    io.emit('roundStart', { target: targetPlayers, raceName: currentRaceName });
  });

  socket.on('placeBet', ({ name, bet }) => {
    if (Object.keys(bets).length >= targetPlayers) return;
    bets[name] = bet;
    const c = Object.keys(bets).length;
    io.emit('betUpdate', { count: c, target: targetPlayers });
    if (c >= targetPlayers) {
      history.push({ raceName: currentRaceName, bets: { ...bets } });
      io.emit('reveal', { bets, raceName: currentRaceName, history });
    }
  });

  socket.on('newRound', () => {
    bets = {};
    raceCounter++;
    io.emit('nameRound', { target: targetPlayers, raceCounter });
  });

  socket.on('newRacingDay', (password) => {
    if (password !== ADMIN_PASSWORD) {
      socket.emit('authError', 'Incorrect password.');
      return;
    }
    bets = {};
    targetPlayers = 0;
    gameStarted = false;
    currentRaceName = '';
    history = [];
    raceCounter = 0;
    io.emit('resetAll');
  });
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
