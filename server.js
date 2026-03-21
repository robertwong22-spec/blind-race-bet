const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
app.use(express.json());

// ========== CHANGE THIS TO YOUR OWN PASSWORD ==========
const ADMIN_PASSWORD = '111111aa';
// =======================================================

let bets = {};
let targetPlayers = 0;
let gameStarted = false;
let currentRaceName = '';
let history = [];
let raceCounter = 0;

// Reset endpoint (password protected)
app.post('/reset', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Wrong password' });
  }
  bets = {};
  targetPlayers = 0;
  gameStarted = false;
  currentRaceName = '';
  history = [];
  raceCounter = 0;
  io.emit('reset');
  res.json({ success: true });
});

// Download all bets as CSV
app.get('/download-bets', (req, res) => {
  let csv = 'Race Number,Race Name,Player,Bet\n';
  history.forEach((race, index) => {
    Object.entries(race.bets).forEach(([player, bet]) => {
      // Wrap in quotes to handle commas in text
      csv += `${index + 1},"${race.raceName}","${player}","${bet}"\n`;
    });
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=race-day-bets.csv');
  res.send(csv);
});

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
    targetPlayers = parseInt(num) || 3;
    gameStarted = true;
    bets = {};
    currentRaceName = '';
    raceCounter++;
    io.emit('nameRound', { target: targetPlayers, raceCounter });
  });

  socket.on('setRaceName', (name) => {
    currentRaceName = name;
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
    currentRaceName = '';
    raceCounter++;
    io.emit('nameRound', { target: targetPlayers, raceCounter });
  });
});

server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log('Server running');
});