import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;
let sql = null;

if (connectionString) {
  try {
    sql = neon(connectionString);
    console.log('✅ Neon Database bağlantısı aktif.');
  } catch (err) {
    console.warn('⚠️ Neon DB başlatılamadı, in-memory mod devrede:', err.message);
  }
} else {
  console.log('ℹ️ DATABASE_URL tanımlanmadı. Skorlar geçici bellekte (in-memory) tutulacak.');
}

// In-memory fallback
const inMemoryLeaderboard = new Map(); // name -> { wins, gamesPlayed, lastPlayed }

/**
 * Tabloları otomatik oluşturur (Neon Postgres)
 */
export async function initDb() {
  if (!sql) return;
  try {
    // 1. Leaderboard tablosu
    await sql`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id SERIAL PRIMARY KEY,
        player_name VARCHAR(100) UNIQUE NOT NULL,
        wins INT DEFAULT 0,
        games_played INT DEFAULT 0,
        last_played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 2. Oyun geçmişi tablosu
    await sql`
      CREATE TABLE IF NOT EXISTS game_history (
        id SERIAL PRIMARY KEY,
        room_code VARCHAR(10),
        winner_name VARCHAR(100),
        loser_name VARCHAR(100),
        penalty_text TEXT,
        played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    console.log('✅ Neon Database tabloları hazır (leaderboard, game_history).');
  } catch (err) {
    console.error('❌ Neon initDb hatası:', err.message);
  }
}

/**
 * Oyun bittiğinde kazananı, eleneni ve oynayanları kaydet
 */
export async function recordGameResult({ roomCode, winner, loser, penaltyText, players = [] }) {
  // 1. Neon DB modu
  if (sql) {
    try {
      // Geçmişe ekle
      await sql`
        INSERT INTO game_history (room_code, winner_name, loser_name, penalty_text)
        VALUES (${roomCode || 'ROOM'}, ${winner?.name || 'Bilinmiyor'}, ${loser?.name || 'Bilinmiyor'}, ${penaltyText || 'Cezalandırıldı'})
      `;

      // Kazananın galibiyetini artır
      if (winner?.name) {
        await sql`
          INSERT INTO leaderboard (player_name, wins, games_played, last_played_at)
          VALUES (${winner.name}, 1, 1, NOW())
          ON CONFLICT (player_name)
          DO UPDATE SET 
            wins = leaderboard.wins + 1,
            games_played = leaderboard.games_played + 1,
            last_played_at = NOW();
        `;
      }

      // Diğer oyuncuların oynadığı oyun sayısını güncelle
      for (const p of players) {
        if (!p.name || p.name === winner?.name) continue;
        await sql`
          INSERT INTO leaderboard (player_name, wins, games_played, last_played_at)
          VALUES (${p.name}, 0, 1, NOW())
          ON CONFLICT (player_name)
          DO UPDATE SET 
            games_played = leaderboard.games_played + 1,
            last_played_at = NOW();
        `;
      }

      console.log(`🏆 Neon DB güncellendi: Kazanan -> ${winner?.name}`);
      return;
    } catch (err) {
      console.error('❌ recordGameResult Neon hatası:', err.message);
    }
  }

  // 2. Fallback: In-memory
  if (winner?.name) {
    const cur = inMemoryLeaderboard.get(winner.name) || { wins: 0, gamesPlayed: 0 };
    inMemoryLeaderboard.set(winner.name, {
      wins: cur.wins + 1,
      gamesPlayed: cur.gamesPlayed + 1,
      lastPlayed: new Date()
    });
  }
  for (const p of players) {
    if (!p.name || p.name === winner?.name) continue;
    const cur = inMemoryLeaderboard.get(p.name) || { wins: 0, gamesPlayed: 0 };
    inMemoryLeaderboard.set(p.name, {
      wins: cur.wins,
      gamesPlayed: cur.gamesPlayed + 1,
      lastPlayed: new Date()
    });
  }
}

/**
 * En çok kazananları getir (Liderlik Tablosu)
 */
export async function getTopPlayers(limit = 10) {
  if (sql) {
    try {
      const rows = await sql`
        SELECT player_name as name, wins, games_played as "gamesPlayed"
        FROM leaderboard
        ORDER BY wins DESC, games_played ASC
        LIMIT ${limit}
      `;
      return rows;
    } catch (err) {
      console.error('❌ getTopPlayers Neon hatası:', err.message);
    }
  }

  // In-memory
  const list = [];
  for (const [name, data] of inMemoryLeaderboard.entries()) {
    list.push({ name, wins: data.wins, gamesPlayed: data.gamesPlayed });
  }
  list.sort((a, b) => b.wins - a.wins);
  return list.slice(0, limit);
}
