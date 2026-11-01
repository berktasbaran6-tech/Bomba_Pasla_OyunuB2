import { BombManager } from './bombmanager.js';
import { PenaltyManager } from './penaltyManager.js';
import { getRandomAbility, getAbilityById, ABILITIES } from './abilities.js';

export const GAME_STATES = {
  LOBBY: 'LOBBY',
  PLAYING: 'PLAYING',
  EXPLODING: 'EXPLODING',
  FINISHED: 'FINISHED'
};

const MIN_PLAYERS = 2;
const NEXT_ROUND_DELAY_MS = 4000;

const DEFAULT_PENALTIES = [
  'Gruptan birini seçip 30 sn boyunca onu aşırı ciddiyetle övüp iltifat yağmuruna tut!',
  'Telefonundaki son WhatsApp mesajını dramatik pembe dizi oyuncusu gibi sesli oku!',
  'Odanın ortasında 20 saniye çılgınca görünmez elektro gitar solosu at!',
  'Sanki Oscar kazanmışsın gibi gruptakilere ağlayarak teşekkür konuşması yap!',
  'Bir sonraki tura kadar her cümlenin sonuna "efendim hazretleri" ekle!',
  'Deşifre olmuş bir ajan gibi masanın altına girip 20 saniye boyunca fısılda!',
  'Gruptan birinin taklidini yap, kim olduğunu diğerleri tahmin etsin!',
  '15 saniye boyunca opera sanatçısı gibi avazın çıktığı kadar arya söyle!'
];

/**
 * Oyun Motoru (GameEngine)
 */
export class GameEngine {
  constructor({ roomId, onBroadcast } = {}) {
    this.roomId = roomId;
    this.onBroadcast = onBroadcast || (() => {});

    this.state = GAME_STATES.LOBBY;
    this.round = 0;
    this.players = [];

    this.botTimer = null;
    this.nextRoundTimer = null;

    this.magnetTargetId = null; // Mıknatıs hedefi

    this.penaltyManager = new PenaltyManager();

    // BombManager patlayınca { victimId, reason } ile bu çağrılır
    this.bombManager = new BombManager(({ victimId, reason }) =>
      this.handleExplosion(victimId, reason)
    );
  }

  // --- Oyuncu yönetimi ---------------------------------------------------

  addPlayer({ id, name, animal, isBot = false }) {
    if (this.state !== GAME_STATES.LOBBY) return { ok: false, reason: 'GAME_STARTED' };
    if (this.getPlayer(id)) return { ok: false, reason: 'ALREADY_JOINED' };

    // Kural: Aynı odadaki kişilere aynı yetenekler verilmesin, her yetenek tek kişiye!
    const assignedAbilities = this.players.map((p) => p.ability);
    const availableAbilities = ABILITIES.filter((a) => !assignedAbilities.includes(a.id));
    const chosenAbility = availableAbilities.length > 0
      ? availableAbilities[Math.floor(Math.random() * availableAbilities.length)]
      : getRandomAbility();

    this.players.push({
      id,
      name,
      animal,
      isBot,
      alive: true,
      score: 0,
      penaltyText: '',
      ability: chosenAbility.id,
      abilityReady: true,
      bombTouchesAfterUse: 0,
      frozenUntil: 0
    });

    this.broadcastState('player:joined', { playerId: id });
    return { ok: true };
  }

  addBot() {
    const id = `bot-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const botAnimals = ['fox', 'bear', 'lion', 'cat', 'monkey', 'dog'];
    const botAnimal = botAnimals[Math.floor(Math.random() * botAnimals.length)];
    return this.addPlayer({ id, name: `Bot ${botAnimal.toUpperCase()}`, animal: botAnimal, isBot: true });
  }

  removePlayer(id) {
    const player = this.getPlayer(id);
    if (!player) return;

    if (this.state === GAME_STATES.LOBBY) {
      this.players = this.players.filter((p) => p.id !== id);
      this.broadcastState('player:left', { playerId: id });
      return;
    }

    player.alive = false;
    const wasHolder = this.bombManager.holderId === id;
    this.broadcastState('player:left', { playerId: id });

    if (this.state === GAME_STATES.PLAYING) {
      if (this.getAlivePlayers().length < MIN_PLAYERS) {
        this.bombManager.stop();
        clearTimeout(this.botTimer);
        this.finishGame();
      } else if (wasHolder) {
        const target = this.pickTarget(id);
        if (target) this.handlePass(id, target.id, { force: true });
      }
    }
  }

  getPlayer(id) {
    return this.players.find((p) => p.id === id) || null;
  }

  getAlivePlayers() {
    return this.players.filter((p) => p.alive);
  }

  setPenaltyText(playerId, text) {
    const player = this.getPlayer(playerId);
    if (!player) return;
    player.penaltyText = String(text || '').slice(0, 120);
    this.broadcastState('penalty:updated', { playerId });
  }

  // --- Yetenek Sistemi (Abilities) ----------------------------------------

  /**
   * Oyuncu yeteneğini tetikler
   * @param {string} playerId
   * @param {string} [targetId]
   */
  useAbility(playerId, targetId = null) {
    if (this.state !== GAME_STATES.PLAYING) return { ok: false, reason: 'NOT_PLAYING' };
    const player = this.getPlayer(playerId);
    if (!player || !player.alive) return { ok: false, reason: 'INVALID_PLAYER' };
    if (!player.abilityReady) return { ok: false, reason: 'NOT_READY' };

    const ability = getAbilityById(player.ability);
    if (!ability) return { ok: false, reason: 'NO_ABILITY' };

    const isHolder = this.bombManager.holderId === playerId;

    if (ability.requiresBomb && !isHolder) {
      return { ok: false, reason: 'REQUIRES_BOMB' };
    }

    // Yetenek Mantığı
    if (ability.id === 'adrenaline') {
      this.bombManager.resetLock();
    } else if (ability.id === 'mirror') {
      const returnTargetId = this.bombManager.lastHolderId;
      const targetPlayer = returnTargetId ? this.getPlayer(returnTargetId) : null;
      if (!targetPlayer || !targetPlayer.alive) {
        return { ok: false, reason: 'NO_MIRROR_TARGET' };
      }
      this.bombManager.passBomb(playerId, targetPlayer.id, { force: true });
      clearTimeout(this.botTimer);
      if (targetPlayer.isBot) this.scheduleBotPass(targetPlayer.id);
      this.broadcastState('bomb:passed', { fromId: playerId, toId: targetPlayer.id, isMirror: true });
    } else if (ability.id === 'freeze') {
      const target = this.getPlayer(targetId);
      if (!target || !target.alive) return { ok: false, reason: 'INVALID_TARGET' };
      target.frozenUntil = Date.now() + 5000;
    } else if (ability.id === 'magnet') {
      const target = this.getPlayer(targetId);
      if (!target || !target.alive) return { ok: false, reason: 'INVALID_TARGET' };
      this.magnetTargetId = target.id;
    } else if (ability.id === 'speedup') {
      this.bombManager.reduceTotalTime(10000);
    } else if (ability.id === 'swap') {
      const target = this.getPlayer(targetId);
      if (!target || !target.alive || target.id === playerId) {
        return { ok: false, reason: 'INVALID_TARGET' };
      }
      this.bombManager.passBomb(playerId, target.id, { force: true });
      clearTimeout(this.botTimer);
      if (target.isBot) this.scheduleBotPass(target.id);
      this.broadcastState('bomb:passed', { fromId: playerId, toId: target.id, isSwap: true });
    }

    // Kural: Yetenek kullanıldıktan sonra kapatılır (cooldown başlar)
    player.abilityReady = false;
    player.bombTouchesAfterUse = 0;

    // 1 saniyelik görsel sembol için yayın
    this.broadcastState('ability:used', {
      playerId,
      abilityId: ability.id,
      symbol: ability.symbol,
      name: ability.name,
      targetId: targetId || null,
      serverNow: Date.now()
    });

    return { ok: true, ability };
  }

  // --- Oyun akışı --------------------------------------------------------

  startGame() {
    if (this.state !== GAME_STATES.LOBBY) return { ok: false, reason: 'NOT_LOBBY' };
    if (this.players.length < MIN_PLAYERS) return { ok: false, reason: 'NOT_ENOUGH_PLAYERS' };

    for (const p of this.players) {
      if (!p.penaltyText || !p.penaltyText.trim()) {
        p.penaltyText = this.randomDefaultPenalty();
      }
      p.alive = true;
      p.abilityReady = true;
      p.bombTouchesAfterUse = 0;
      p.frozenUntil = 0;
    }

    this.round = 0;
    this.startNextRound();
    return { ok: true };
  }

  startNextRound() {
    clearTimeout(this.nextRoundTimer);
    clearTimeout(this.botTimer);
    this.magnetTargetId = null;

    const alive = this.getAlivePlayers();
    if (alive.length < MIN_PLAYERS) {
      this.finishGame();
      return;
    }

    this.round += 1;
    this.state = GAME_STATES.PLAYING;

    const starter = alive[Math.floor(Math.random() * alive.length)];

    // Şarj kuralı: bomba starter'a geldiğinde kontrol
    if (!starter.abilityReady) {
      starter.bombTouchesAfterUse += 1;
      if (starter.bombTouchesAfterUse >= 2) {
        starter.abilityReady = true;
        starter.bombTouchesAfterUse = 0;
      }
    }

    this.bombManager.startRound(starter.id);

    if (starter.isBot) {
      this.scheduleBotPass(starter.id);
    }

    this.broadcastState('round:started', {
      round: this.round,
      starterId: starter.id
    });
  }

  /**
   * Bombayı aktarır.
   */
  handlePass(fromId, toId, opts = {}) {
    if (this.state !== GAME_STATES.PLAYING) return { ok: false, reason: 'NOT_PLAYING' };

    const fromPlayer = this.getPlayer(fromId);
    if (!opts.force && fromPlayer && fromPlayer.frozenUntil > Date.now()) {
      return { ok: false, reason: 'FROZEN', remainingFreezeMs: fromPlayer.frozenUntil - Date.now() };
    }

    // Mıknatıs etkisi: Eğer mıknatıs hedeflendiyse bomba oraya çekilir!
    let targetId = toId;
    if (this.magnetTargetId) {
      const magTarget = this.getPlayer(this.magnetTargetId);
      if (magTarget && magTarget.alive && magTarget.id !== fromId) {
        targetId = magTarget.id;
      }
      this.magnetTargetId = null; // Tek seferlik çalışır
    }

    const target = targetId ? this.getPlayer(targetId) : this.pickTarget(fromId);
    if (!target || !target.alive) return { ok: false, reason: 'INVALID_TARGET' };

    if (opts.force) {
      this.bombManager.unlockAt = 0;
    }

    const result = this.bombManager.passBomb(fromId, target.id, opts);
    if (!result.ok) return result;

    // Şarj Kuralı: Bomba kendisine ikinci kez geldiğinde yeteneği açılır!
    if (!target.abilityReady) {
      target.bombTouchesAfterUse += 1;
      if (target.bombTouchesAfterUse >= 2) {
        target.abilityReady = true;
        target.bombTouchesAfterUse = 0;
      }
    }

    clearTimeout(this.botTimer);
    if (target.isBot) this.scheduleBotPass(target.id);

    this.broadcastState('bomb:passed', { fromId, toId: target.id });
    return { ok: true };
  }

  pickTarget(fromId) {
    const candidates = this.getAlivePlayers().filter((p) => p.id !== fromId);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Bot pas ve yetenek kullanımı
   */
  scheduleBotPass(botId) {
    clearTimeout(this.botTimer);
    if (this.state !== GAME_STATES.PLAYING) return;
    if (this.bombManager.holderId !== botId) return;

    const bot = this.getPlayer(botId);
    if (!bot || !bot.alive) return;

    const now = Date.now();
    const { lockEndsAt } = this.bombManager.getState();
    const freeAt = Math.max(lockEndsAt, bot.frozenUntil || 0);
    const wait = Math.max(0, freeAt - now) + 250 + Math.floor(Math.random() * 500);

    this.botTimer = setTimeout(() => {
      if (this.state !== GAME_STATES.PLAYING) return;
      if (this.bombManager.holderId !== botId) return;

      const currentBot = this.getPlayer(botId);
      if (!currentBot || !currentBot.alive) return;

      // Donma süresi devam ediyorsa veya kilit bitmediyse tekrar zamanla
      if (currentBot.frozenUntil > Date.now() || Date.now() < this.bombManager.unlockAt) {
        this.scheduleBotPass(botId);
        return;
      }

      // Bot yetenek kullanımı (%35 şans)
      if (currentBot.abilityReady && Math.random() < 0.35) {
        if (currentBot.ability === 'adrenaline') {
          this.useAbility(botId);
        } else if (currentBot.ability === 'mirror' && this.bombManager.lastHolderId) {
          const res = this.useAbility(botId);
          if (res && res.ok) return;
        } else if (currentBot.ability === 'swap') {
          const target = this.pickTarget(botId);
          if (target) {
            const res = this.useAbility(botId, target.id);
            if (res && res.ok) return;
          }
        } else if (currentBot.ability === 'freeze') {
          const target = this.pickTarget(botId);
          if (target) {
            this.useAbility(botId, target.id);
          }
        }
      }

      const target = this.pickTarget(botId);
      if (target) {
        const passResult = this.handlePass(botId, target.id);
        if (!passResult || !passResult.ok) {
          // Başarısız olduysa (örn: hedef de donduysa veya kilit sürüyorsa) tekrar dene
          this.scheduleBotPass(botId);
        }
      } else {
        this.scheduleBotPass(botId);
      }
    }, wait);
  }

  handleExplosion(holderId, reason) {
    if (this.state !== GAME_STATES.PLAYING) return;

    this.bombManager.clearAllTimers();
    clearTimeout(this.botTimer);
    this.magnetTargetId = null;
    this.state = GAME_STATES.EXPLODING;

    const explodedPlayer = this.getPlayer(holderId);
    if (explodedPlayer) explodedPlayer.alive = false;

    const penalty = explodedPlayer ? this.getPenaltyFor(explodedPlayer) : '';

    this.broadcastState('bomb:exploded', {
      playerId: holderId,
      reason,
      penalty
    });

    this.nextRoundTimer = setTimeout(() => {
      if (this.getAlivePlayers().length < MIN_PLAYERS) {
        this.finishGame();
      } else {
        this.startNextRound();
      }
    }, NEXT_ROUND_DELAY_MS);
  }

  finishGame() {
    clearTimeout(this.nextRoundTimer);
    clearTimeout(this.botTimer);
    this.magnetTargetId = null;
    this.bombManager.stop();
    this.state = GAME_STATES.FINISHED;

    const winner = this.getAlivePlayers()[0] || null;
    if (winner) {
      winner.score = (winner.score || 0) + 1;
    }

    this.broadcastState('game:finished', {
      winnerId: winner ? winner.id : null,
      winnerScore: winner ? winner.score : 0
    });
  }

  resetGame() {
    clearTimeout(this.nextRoundTimer);
    clearTimeout(this.botTimer);
    this.magnetTargetId = null;
    this.bombManager.stop();

    this.state = GAME_STATES.LOBBY;
    this.round = 0;

    // Herkese birbirinden farklı yeni yetenekler dağıt, skorları KORU
    const shuffledAbilities = [...ABILITIES].sort(() => Math.random() - 0.5);
    this.players.forEach((p, idx) => {
      p.alive = true;
      p.ability = shuffledAbilities[idx % shuffledAbilities.length].id;
      p.abilityReady = true;
      p.bombTouchesAfterUse = 0;
      p.frozenUntil = 0;
    });

    this.broadcastState('game:reset');
  }

  randomDefaultPenalty() {
    return DEFAULT_PENALTIES[Math.floor(Math.random() * DEFAULT_PENALTIES.length)];
  }

  getPenaltyFor(player) {
    try {
      if (this.penaltyManager && typeof this.penaltyManager.getPenalty === 'function') {
        const p = this.penaltyManager.getPenalty(player.id);
        if (p) return p;
      }
    } catch {
      /* varsayılan */
    }
    return player.penaltyText || this.randomDefaultPenalty();
  }

  // --- Snapshot ve Yayın -------------------------------------------------

  snapshot() {
    const now = Date.now();
    return {
      roomId: this.roomId,
      state: this.state,
      round: this.round,
      magnetTargetId: this.magnetTargetId,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        animal: p.animal,
        isBot: p.isBot,
        alive: p.alive,
        score: p.score || 0,
        hasPenalty: !!p.penaltyText,
        abilityId: p.ability,
        abilityReady: p.abilityReady,
        bombTouchesAfterUse: p.bombTouchesAfterUse,
        frozen: (p.frozenUntil || 0) > now,
        frozenUntil: p.frozenUntil || 0,
      })),
      bomb: this.bombManager.getState()
    };
  }

  broadcastState(event, extra = {}) {
    this.onBroadcast(event, { ...this.snapshot(), ...extra });
  }
}
