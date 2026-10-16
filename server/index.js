import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameEngine } from '../src/gameEngine.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDb, recordGameResult, getTopPlayers } from './db.js';

// Veritabanını hazırla
initDb();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Derlenmiş frontend dosyaları sun (tünel / prod modu)
import { existsSync } from 'fs';
if (existsSync(DIST)) {
  app.use(express.static(DIST));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/socket.io')) {
      res.sendFile(join(DIST, 'index.html'));
    } else {
      next();
    }
  });
}

// Neon DB Leaderboard API
app.get('/api/leaderboard', async (req, res) => {
  try {
    const list = await getTopPlayers(20);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// roomCode → { engine: GameEngine, hostId: string }
const rooms = new Map();

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on('connection', (socket) => {
  let roomCode = null;

  // ── Oda oluştur ──────────────────────────────────────────────────
  socket.on('room:create', ({ name, animal, penalty }) => {
    const code = generateCode();
    roomCode = code;

    const engine = new GameEngine({
      roomId: code,
      onBroadcast: (event, payload) => {
        io.to(code).emit(event, payload);
        if (event === 'game:finished') {
          const winner = engine.getPlayer(payload.winnerId);
          recordGameResult({
            roomCode: code,
            winner,
            loser: null,
            players: engine.players
          }).catch(console.error);
        }
      }
    });

    rooms.set(code, { engine, hostId: socket.id });
    socket.join(code);
    engine.addPlayer({ id: socket.id, name, animal });
    if (penalty) engine.setPenaltyText(socket.id, penalty);

    socket.emit('room:created', { code });
    io.to(code).emit('room:updated', { ...engine.snapshot(), hostId: socket.id });
  });

  // ── Odaya katıl ──────────────────────────────────────────────────
  socket.on('room:join', ({ code, name, animal, penalty }) => {
    const upperCode = code?.toUpperCase();
    const room = rooms.get(upperCode);

    if (!room) {
      socket.emit('room:error', 'Oda bulunamadı! Kodu kontrol et.');
      return;
    }
    if (room.engine.state !== 'LOBBY') {
      socket.emit('room:error', 'Oyun zaten başladı!');
      return;
    }

    roomCode = upperCode;
    socket.join(roomCode);

    const result = room.engine.addPlayer({ id: socket.id, name, animal });
    if (!result.ok) {
      socket.emit('room:error', result.reason);
      return;
    }
    if (penalty) room.engine.setPenaltyText(socket.id, penalty);

    socket.emit('room:joined', { code: roomCode });
    io.to(roomCode).emit('room:updated', { ...room.engine.snapshot(), hostId: room.hostId });
  });

  // ── Bot ekle (sadece host) ───────────────────────────────────────
  socket.on('bot:add', () => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return;
    room.engine.addBot();
    io.to(roomCode).emit('room:updated', { ...room.engine.snapshot(), hostId: room.hostId });
  });

  // ── Bot çıkar (sadece host) ──────────────────────────────────────
  socket.on('bot:remove', ({ id }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return;
    room.engine.removePlayer(id);
    io.to(roomCode).emit('room:updated', { ...room.engine.snapshot(), hostId: room.hostId });
  });

  // ── Oyunu başlat (sadece host) ───────────────────────────────────
  socket.on('game:start', () => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return;

    const result = room.engine.startGame();
    if (!result.ok) socket.emit('room:error', result.reason);
  });

  // ── Bomba pas (hedefe veya rastgele) ─────────────────────────────
  socket.on('bomb:pass', (data) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const targetId = typeof data === 'object' ? data?.toId : data;
    room.engine.handlePass(socket.id, targetId || null);
  });

  // ── Özel Yetenek Kullanımı ──────────────────────────────────────
  socket.on('ability:use', (data) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const targetId = typeof data === 'object' ? data?.targetId : data;
    room.engine.useAbility(socket.id, targetId || null);
  });

  // ── Tekrar oyna (host sıfırla) ───────────────────────────────────
  socket.on('game:reset', () => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return;
    room.engine.resetGame();
    io.to(roomCode).emit('room:updated', { ...room.engine.snapshot(), hostId: room.hostId });
  });

  // ── Bağlantı koptu ───────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    room.engine.removePlayer(socket.id);

    if (room.engine.players.length === 0) {
      rooms.delete(roomCode);
      return;
    }

    // Host ayrıldıysa yeni host ata
    if (room.hostId === socket.id && room.engine.players.length > 0) {
      room.hostId = room.engine.players[0].id;
    }

    io.to(roomCode).emit('room:updated', { ...room.engine.snapshot(), hostId: room.hostId });
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n💣 Bomba Sunucusu çalışıyor → http://localhost:${PORT}\n`);
});
