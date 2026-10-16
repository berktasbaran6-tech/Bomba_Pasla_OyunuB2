import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { BombManager } from './bombmanager.js';
import { GameArena } from './GameArena';
import { getRandomAbility, getAbilityById, ABILITIES } from './abilities.js';

/* ─── Sabitler ───────────────────────────────────────────────── */
const ANIMALS = [
  { id: 'rabbit',  emoji: '🐰', label: 'Tavşan'  },
  { id: 'fox',     emoji: '🦊', label: 'Tilki'   },
  { id: 'bear',    emoji: '🐻', label: 'Ayı'     },
  { id: 'cat',     emoji: '🐱', label: 'Kedi'    },
  { id: 'dog',     emoji: '🐶', label: 'Köpek'   },
  { id: 'monkey',  emoji: '🐵', label: 'Maymun'  },
  { id: 'lion',    emoji: '🦁', label: 'Aslan'   },
  { id: 'penguin', emoji: '🐧', label: 'Penguen' },
];

const BOT_POOL = [
  { name: 'Tilki Bot',  animal: 'fox',     penalty: 'Telefonundaki son WhatsApp mesajını dramatik ses tonuyla oku!' },
  { name: 'Ayı Bot',    animal: 'bear',    penalty: 'Gruptan birini seçip 30 saniye boyunca aşırı ciddiyetle öv!' },
  { name: 'Aslan Bot',  animal: 'lion',    penalty: 'Sanki Oscar kazanmış gibi ağlayarak teşekkür konuşması yap!' },
  { name: 'Kedi Bot',   animal: 'cat',     penalty: 'Gruptan birinin taklidini yap, diğerleri tahmin etsin!' },
  { name: 'Maymun Bot', animal: 'monkey',  penalty: 'Odanın ortasında 20 saniye çılgınca görünmez elektro gitar çal!' },
  { name: 'Köpek Bot',  animal: 'dog',     penalty: 'Bir sonraki tura kadar her cümlenin sonuna "efendim hazretleri" ekle!' },
];

const PENALTY_SUGGESTIONS = [
  'Gruptan birini seçip 30 sn boyunca onu aşırı ciddiyetle övüp iltifat yağmuruna tut!',
  'Telefonundaki son WhatsApp mesajını dramatik pembe dizi oyuncusu gibi sesli oku!',
  'Odanın ortasında 20 saniye çılgınca görünmez elektro gitar solosu at!',
  'Sanki Oscar kazanmışsın gibi gruptakilere ağlayarak teşekkür konuşması yap!',
  'Gruptaki herkesin gözünün içine tek tek 5 saniye hiç kırpmadan bak!',
  'Bir sonraki tura kadar her cümlenin sonuna "efendim hazretleri" ekle!',
  'Deşifre olmuş bir ajan gibi masanın altına girip 20 saniye boyunca fısılda!',
  'Rehberindeki son kişiyi hoparlörde ara ve "Sipariş ettiğiniz 50 kilo hıyar yola çıktı" de!',
  'Gruptan birinin taklidini yap, kim olduğunu diğerleri bilmeye çalışsın!',
  'Kendi kendine aşırı ciddi bir konuda 30 saniye boyunca tartış ve kendini azarla!',
  'Bir sonraki tura kadar kollarını hiç bükmeden robot dansı duruşuyla oyna!',
  'En sevdiğin çizgi film karakterinin sesiyle gruptan içtenlikle özür dile!',
  'Gruptan birine aşık olmuş gibi aşırı abartılı ve duygusal bir aşk şiiri uydur!',
  '30 saniye boyunca canlı yayın hava durumu spikeri gibi odadaki gerilimi sun!',
  'Bir sonraki tura kadar konuşurken sadece soru sorarak cümle kur!',
  'Gözlerini kısıp dedektif gibi odadaki birini hayali ve absürt bir suçla itham et!',
  'Sanki çok sıcak bir çorba içiyormuş gibi her cümlende "Huuu püfff" de!',
  'Gruptaki birinin elini öpüp alnına koy ve "Hakkını helal et usta" de!',
  '15 saniye boyunca opera sanatçısı gibi avazın çıktığı kadar arya söyle!',
  'T-rex gibi kollarını göğsüne yapıştırıp odayı 30 saniye homurdanarak turlayın!'
];

const animalEmoji = (id) => ANIMALS.find(a => a.id === id)?.emoji ?? '🐾';

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = '';
  for (let i = 0; i < 4; i++) {
    res += chars[Math.floor(Math.random() * chars.length)];
  }
  return res;
}

// Socket instance
const socketUrl = typeof window !== 'undefined' && window.location.port === '5173'
  ? 'http://localhost:3001'
  : undefined;

let globalSocket = null;
try {
  globalSocket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    timeout: 5000,
  });
} catch {
  /* offline mod */
}

/* ─── Ana Bileşen ────────────────────────────────────────────── */
export default function App() {
  const [screen,           setScreen]           = useState('SETUP');
  const [myName,           setMyName]           = useState('');
  const [myAnimal,         setMyAnimal]         = useState('rabbit');
  const [myPenalty,        setMyPenalty]        = useState('');
  const [roomCode,         setRoomCode]         = useState('');
  const [joinCodeInput,    setJoinCodeInput]    = useState('');
  const [isJoining,        setIsJoining]        = useState(false);
  const [isOnline,         setIsOnline]         = useState(false);
  const [myId,             setMyId]             = useState('player-me');
  const [hostId,           setHostId]           = useState('player-me');
  const [myAbilityId,      setMyAbilityId]      = useState(() => getRandomAbility().id);
  const [lastAbilityEvent, setLastAbilityEvent] = useState(null);

  const [lobbyPlayers,  setLobbyPlayers]  = useState([]);
  const [alivePlayers,  setAlivePlayers]  = useState([]);
  const [bombState,     setBombState]     = useState(null);
  const [explodeInfo,   setExplodeInfo]   = useState(null);
  const [winner,        setWinner]        = useState(null);
  const [round,         setRound]         = useState(1);
  const [error,         setError]         = useState('');
  const [copied,        setCopied]        = useState(false);

  const aliveRef      = useRef([]);
  const bombRef       = useRef(null);
  const pollRef       = useRef(null);
  const botTimers     = useRef({});
  const startRoundRef = useRef(null);

  useEffect(() => { aliveRef.current = alivePlayers; }, [alivePlayers]);

  /* ── Socket Dinleyicileri ─────────────────────────────────── */
  useEffect(() => {
    if (!globalSocket) return;

    function onConnect() {
      setIsOnline(true);
      setMyId(globalSocket.id);
    }

    function onDisconnect() {
      setIsOnline(false);
    }

    function onRoomCreated({ code }) {
      setRoomCode(code);
      setScreen('LOBBY');
      setError('');
    }

    function onRoomJoined({ code }) {
      setRoomCode(code);
      setScreen('LOBBY');
      setError('');
    }

    function onRoomError(msg) {
      setError(typeof msg === 'string' ? msg : 'Bir hata oluştu!');
    }

    function onRoomUpdated(data) {
      if (data.roomId) setRoomCode(data.roomId);
      if (data.hostId) setHostId(data.hostId);
      if (data.players) {
        setLobbyPlayers(data.players);
        const alive = data.players.filter(p => p.alive);
        setAlivePlayers(alive);

        // Kendi yeteneğini güncelle
        const meInRoom = data.players.find(p => p.id === globalSocket.id);
        if (meInRoom?.abilityId) setMyAbilityId(meInRoom.abilityId);
      }
      if (data.round) setRound(data.round);
      if (data.bomb) setBombState(data.bomb);

      if (data.state === 'LOBBY') {
        setScreen('LOBBY');
        setExplodeInfo(null);
        setWinner(null);
      } else if (data.state === 'PLAYING') {
        setScreen('PLAYING');
      } else if (data.state === 'FINISHED') {
        const win = data.players?.find(p => p.alive);
        setWinner(win || null);
        setScreen('GAMEOVER');
      }
    }

    function onRoundStarted(data) {
      setScreen('PLAYING');
      setExplodeInfo(null);
      setRound(data.round || 1);
      if (data.players) {
        const alive = data.players.filter(p => p.alive);
        setAlivePlayers(alive);
        setLobbyPlayers(data.players);
        const meInRoom = data.players.find(p => p.id === globalSocket.id);
        if (meInRoom?.abilityId) setMyAbilityId(meInRoom.abilityId);
      }
      if (data.bomb) setBombState(data.bomb);
    }

    function onBombPassed(data) {
      if (data.bomb) setBombState(data.bomb);
      if (data.players) {
        setAlivePlayers(data.players.filter(p => p.alive));
      }
    }

    function onAbilityUsed(data) {
      setLastAbilityEvent(data);
    }

    function onBombExploded(data) {
      setBombState(null);
      const victim = data.players?.find(p => p.id === data.playerId);
      const isMe = data.playerId === globalSocket.id;
      setExplodeInfo({
        victimId: data.playerId,
        victimName: victim?.name ?? 'Oyuncu',
        isMe,
        penalty: data.penalty || 'Ceza belirlendi!',
      });
      setScreen('EXPLODE');
    }

    function onGameFinished(data) {
      const win = data.players?.find(p => p.id === data.winnerId) || data.players?.find(p => p.alive);
      setWinner(win || null);
      if (data.players) {
        setLobbyPlayers(data.players);
        setAlivePlayers(data.players);
      }
      setScreen('GAMEOVER');
    }

    globalSocket.on('connect', onConnect);
    globalSocket.on('disconnect', onDisconnect);
    globalSocket.on('room:created', onRoomCreated);
    globalSocket.on('room:joined', onRoomJoined);
    globalSocket.on('room:error', onRoomError);
    globalSocket.on('room:updated', onRoomUpdated);
    globalSocket.on('round:started', onRoundStarted);
    globalSocket.on('bomb:passed', onBombPassed);
    globalSocket.on('ability:used', onAbilityUsed);
    globalSocket.on('bomb:exploded', onBombExploded);
    globalSocket.on('game:finished', onGameFinished);

    if (globalSocket.connected) {
      setIsOnline(true);
      setMyId(globalSocket.id);
    }

    return () => {
      globalSocket.off('connect', onConnect);
      globalSocket.off('disconnect', onDisconnect);
      globalSocket.off('room:created', onRoomCreated);
      globalSocket.off('room:joined', onRoomJoined);
      globalSocket.off('room:error', onRoomError);
      globalSocket.off('room:updated', onRoomUpdated);
      globalSocket.off('round:started', onRoundStarted);
      globalSocket.off('bomb:passed', onBombPassed);
      globalSocket.off('ability:used', onAbilityUsed);
      globalSocket.off('bomb:exploded', onBombExploded);
      globalSocket.off('game:finished', onGameFinished);
    };
  }, []);

  /* ── Yerel Offline Mod Yardımı ────────────────────────────── */
  const scheduleBotPass = useCallback((botId) => {
    clearTimeout(botTimers.current[botId]);
    const lockEndsAt = bombRef.current?.unlockAt ?? Date.now();
    const wait = Math.max(0, lockEndsAt - Date.now()) + 300 + Math.floor(Math.random() * 900);

    botTimers.current[botId] = setTimeout(() => {
      if (!bombRef.current?.active || bombRef.current.holderId !== botId) return;
      const alive = aliveRef.current;
      const candidates = alive.filter(p => p.id !== botId);
      if (!candidates.length) return;
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      const result = bombRef.current.passBomb(botId, target.id);
      if (result.ok) {
        setBombState({ ...bombRef.current.getState() });
        if (target.isBot) scheduleBotPass(target.id);
      }
    }, wait);
  }, []);

  const startRoundLocal = useCallback((players, currentRound = 1) => {
    bombRef.current?.stop();
    clearInterval(pollRef.current);
    Object.values(botTimers.current).forEach(clearTimeout);
    botTimers.current = {};

    const bm = new BombManager(({ victimId }) => {
      clearInterval(pollRef.current);
      Object.values(botTimers.current).forEach(clearTimeout);

      const alive     = aliveRef.current;
      const victim    = alive.find(p => p.id === victimId);
      const survivors = alive.filter(p => p.id !== victimId);

      setExplodeInfo({
        victimId,
        victimName: victim?.name ?? 'Oyuncu',
        isMe: victimId === myId,
        penalty: victim?.penalty || 'Ceza belirlendi!',
      });
      setBombState(null);
      setScreen('EXPLODE');

      setTimeout(() => {
        if (survivors.length < 2) {
          const win = survivors[0] ?? null;
          if (win) {
            setLobbyPlayers(prev => prev.map(p => p.id === win.id ? { ...p, score: (p.score || 0) + 1 } : p));
          }
          setWinner(win);
          setScreen('GAMEOVER');
        } else {
          setAlivePlayers(survivors);
          aliveRef.current = survivors;
          const nextR = currentRound + 1;
          setRound(nextR);
          setScreen('PLAYING');
          startRoundRef.current(survivors, nextR);
        }
      }, 3000);
    });

    bombRef.current = bm;
    const starter = players[Math.floor(Math.random() * players.length)];
    bm.startRound(starter.id);
    setBombState({ ...bm.getState() });

    pollRef.current = setInterval(() => {
      if (bombRef.current?.active) {
        setBombState({ ...bombRef.current.getState() });
      }
    }, 100);

    if (starter.isBot) scheduleBotPass(starter.id);
  }, [scheduleBotPass, myId]);

  useEffect(() => { startRoundRef.current = startRoundLocal; }, [startRoundLocal]);

  /* ── Pas Verme ────────────────────────────────────────────── */
  const handlePass = useCallback((targetId = null) => {
    if (globalSocket?.connected && roomCode) {
      globalSocket.emit('bomb:pass', { toId: targetId });
      return;
    }

    if (!bombRef.current?.active || bombRef.current.holderId !== myId) return;
    const alive = aliveRef.current;
    let target = null;
    if (targetId) {
      target = alive.find(p => p.id === targetId);
    }
    if (!target) {
      const candidates = alive.filter(p => p.id !== myId);
      if (!candidates.length) return;
      target = candidates[Math.floor(Math.random() * candidates.length)];
    }

    const result = bombRef.current.passBomb(myId, target.id);
    if (result.ok) {
      // Şarj takibi offline
      setAlivePlayers(prev => prev.map(p => {
        if (p.id === target.id && !p.abilityReady) {
          const nextTouches = (p.bombTouchesAfterUse || 0) + 1;
          return {
            ...p,
            bombTouchesAfterUse: nextTouches,
            abilityReady: nextTouches >= 2
          };
        }
        return p;
      }));

      setBombState({ ...bombRef.current.getState() });
      if (target.isBot) scheduleBotPass(target.id);
    }
  }, [roomCode, myId, scheduleBotPass]);

  /* ── Yetenek Kullanımı ──────────────────────────────────────── */
  const handleUseAbility = useCallback((abilityId, targetId = null) => {
    if (globalSocket?.connected && roomCode) {
      globalSocket.emit('ability:use', { targetId });
      return;
    }

    // Yerel Offline Mod
    const ability = getAbilityById(abilityId);
    if (!ability) return;

    if (ability.id === 'adrenaline') {
      bombRef.current?.resetLock();
      setBombState({ ...bombRef.current.getState() });
    } else if (ability.id === 'mirror') {
      const returnTarget = bombRef.current?.lastHolderId;
      if (returnTarget) {
        bombRef.current?.passBomb(myId, returnTarget, { force: true });
        setBombState({ ...bombRef.current.getState() });
      }
    } else if (ability.id === 'freeze') {
      if (targetId) {
        setAlivePlayers(prev => prev.map(p => p.id === targetId ? { ...p, frozen: true, frozenUntil: Date.now() + 5000 } : p));
      }
    } else if (ability.id === 'speedup') {
      bombRef.current?.reduceTotalTime(10000);
      setBombState({ ...bombRef.current.getState() });
    } else if (ability.id === 'swap') {
      if (targetId) {
        bombRef.current?.passBomb(myId, targetId, { force: true });
        setBombState({ ...bombRef.current.getState() });
      }
    }

    setAlivePlayers(prev => prev.map(p => p.id === myId ? { ...p, abilityReady: false, bombTouchesAfterUse: 0 } : p));
    setLastAbilityEvent({ playerId: myId, symbol: ability.symbol, id: Date.now() });
  }, [roomCode, myId]);

  /* ── Ceza Önerisi Getir ────────────────────────────────────── */
  const handleSuggestPenalty = () => {
    const pool = PENALTY_SUGGESTIONS.filter(p => p !== myPenalty);
    const chosen = pool[Math.floor(Math.random() * pool.length)] || PENALTY_SUGGESTIONS[0];
    setMyPenalty(chosen);
  };

  const myAbility = getAbilityById(myAbilityId);

  /* ── 1. SETUP EKRANI ──────────────────────────────────────── */
  if (screen === 'SETUP') {
    const handleCreate = () => {
      const name = myName.trim() || 'Oyuncu';
      const penalty = myPenalty.trim() || 'Bir sonraki tur şarkı söyle!';

      if (globalSocket?.connected) {
        globalSocket.emit('room:create', { name, animal: myAnimal, penalty });
        return;
      }

      const me = {
        id: myId,
        name,
        animal: myAnimal,
        penalty,
        isBot: false,
        abilityId: myAbilityId,
        abilityReady: true,
        bombTouchesAfterUse: 0,
      };
      setRoomCode(generateRoomCode());
      setLobbyPlayers([me]);
      setHostId(myId);
      setError('');
      setScreen('LOBBY');
    };

    const handleJoin = () => {
      const code = joinCodeInput.trim().toUpperCase();
      if (!code) { setError('Lütfen oda kodunu yaz!'); return; }
      const name = myName.trim() || 'Oyuncu';
      const penalty = myPenalty.trim() || 'Bir sonraki tur şarkı söyle!';

      if (globalSocket?.connected) {
        globalSocket.emit('room:join', { code, name, animal: myAnimal, penalty });
        return;
      }

      const me = {
        id: myId,
        name,
        animal: myAnimal,
        penalty,
        isBot: false,
        abilityId: myAbilityId,
        abilityReady: true,
        bombTouchesAfterUse: 0,
      };
      setRoomCode(code);
      setLobbyPlayers([me]);
      setHostId(myId);
      setError('');
      setScreen('LOBBY');
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-slate-900 select-none">
        <span className="text-7xl animate-bounce">💣</span>
        <div className="text-center">
          <h1 className="text-4xl font-black text-amber-400 tracking-tight">Bomba Oyunu</h1>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-[11px] text-slate-400 font-bold">
              {isOnline ? 'Çok Oyunculu Sunucu Aktif' : 'Yerel Mod'}
            </span>
          </div>
        </div>

        <div className="w-full max-w-sm flex flex-col gap-3">
          <input
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-500 text-lg font-bold focus:outline-none focus:border-amber-400 transition"
            placeholder="Adın ne?"
            value={myName}
            maxLength={16}
            onChange={e => { setMyName(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />

          {/* Ceza Girişi - Sadece Zar */}
          <div className="flex gap-2 items-center">
            <input
              className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-rose-400 transition"
              placeholder="💀 Gizli cezanı yaz..."
              value={myPenalty}
              maxLength={120}
              onChange={e => setMyPenalty(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button
              type="button"
              onClick={handleSuggestPenalty}
              className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-rose-600/30 hover:bg-rose-600/50 active:scale-90 border border-rose-500/50 rounded-xl text-2xl transition cursor-pointer shadow-md group"
              title="Zar At: Yaratıcı Ceza Önerisi"
            >
              <span className="group-hover:rotate-45 transition-transform duration-200">🎲</span>
            </button>
          </div>

          <p className="text-slate-400 text-xs text-center mt-1">Karakterini seç:</p>
          <div className="grid grid-cols-4 gap-2">
            {ANIMALS.map(a => (
              <button
                key={a.id}
                onClick={() => setMyAnimal(a.id)}
                className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all ${
                  myAnimal === a.id
                    ? 'border-amber-400 bg-amber-400/15 scale-105 shadow-lg shadow-amber-500/20'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-500'
                }`}
              >
                <span className="text-3xl">{a.emoji}</span>
                <span className="text-[10px] text-slate-300 mt-1 font-bold">{a.label}</span>
              </button>
            ))}
          </div>

          {error && <p className="text-rose-400 text-xs text-center font-bold bg-rose-950/60 p-2 rounded-lg border border-rose-800">{error}</p>}

          {!isJoining ? (
            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={handleCreate}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-lg rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🏠</span> ODA KUR
              </button>

              <button
                onClick={() => { setIsJoining(true); setError(''); }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-sky-400 border border-sky-500/30 font-bold text-base rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🚪</span> Odaya Katıl
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-2 p-3 bg-slate-800 border border-sky-500/40 rounded-2xl">
              <p className="text-xs font-bold text-sky-300 text-center">Oda Kodunu Gir:</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 text-lg font-mono font-black text-center tracking-widest uppercase focus:outline-none focus:border-sky-400"
                  placeholder="KOD"
                  maxLength={6}
                  value={joinCodeInput}
                  onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                />
                <button
                  onClick={handleJoin}
                  className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 active:scale-95 text-slate-950 font-black rounded-xl transition-all cursor-pointer"
                >
                  GİR →
                </button>
              </div>
              <button
                onClick={() => setIsJoining(false)}
                className="text-[11px] text-slate-400 hover:text-slate-200 text-center mt-1 cursor-pointer"
              >
                ← Geri Dön (Oda Kur)
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── 2. LOBBY EKRANI ──────────────────────────────────────── */
  if (screen === 'LOBBY') {
    const isHost = hostId === myId || !globalSocket?.connected;
    const usedBotNames = lobbyPlayers.filter(p => p.isBot).map(p => p.name);
    const nextBot = BOT_POOL.find(b => !usedBotNames.includes(b.name));
    const canStart = lobbyPlayers.length >= 2;
    const canAddBot = lobbyPlayers.length < 8 && !!nextBot;

    const addBot = () => {
      if (globalSocket?.connected) {
        globalSocket.emit('bot:add');
        return;
      }
      if (!nextBot) return;

      const assignedAbilities = lobbyPlayers.map(p => p.abilityId);
      const availableAbilities = ABILITIES.filter(a => !assignedAbilities.includes(a.id));
      const chosenAbility = availableAbilities.length > 0
        ? availableAbilities[Math.floor(Math.random() * availableAbilities.length)]
        : getRandomAbility();

      const bot = {
        id: `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: nextBot.name,
        animal: nextBot.animal,
        penalty: nextBot.penalty,
        isBot: true,
        abilityId: chosenAbility.id,
        abilityReady: true,
        bombTouchesAfterUse: 0,
      };
      setLobbyPlayers(prev => [...prev, bot]);
    };

    const removeBot = (id) => {
      if (globalSocket?.connected) {
        globalSocket.emit('bot:remove', { id });
        return;
      }
      setLobbyPlayers(prev => prev.filter(p => p.id !== id));
    };

    const startGame = () => {
      if (!canStart) {
        setError('Oyunu başlatmak için en az 1 arkadaş veya bot ekle!');
        return;
      }
      if (globalSocket?.connected) {
        globalSocket.emit('game:start');
        return;
      }

      const players = [...lobbyPlayers];
      setAlivePlayers(players);
      aliveRef.current = players;
      setRound(1);
      setWinner(null);
      setExplodeInfo(null);
      setError('');
      setScreen('PLAYING');
      startRoundLocal(players, 1);
    };

    const copyCode = () => {
      navigator.clipboard?.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-slate-900 select-none">
        {/* Oda Numarası */}
        <div className="flex flex-col items-center gap-1 bg-slate-800/80 border border-amber-500/40 px-6 py-3 rounded-2xl shadow-xl text-center">
          <span className="text-[11px] text-amber-400 font-bold uppercase tracking-widest">Oda Numarası</span>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-black font-mono tracking-widest text-white">
              {roomCode}
            </span>
            <button
              onClick={copyCode}
              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 active:scale-90 rounded-lg text-xs font-bold text-amber-300 border border-slate-600 transition cursor-pointer"
            >
              {copied ? '✓ Kopyalandı' : 'Kopyala'}
            </button>
          </div>
          <span className="text-[10px] text-slate-400">
            Arkadaşların bu kodla odaya katılabilir!
          </span>
        </div>

        {/* Senin Gizli Yeteneğin Kartı (Sadece Sen Görürsün) */}
        {myAbility && (
          <div className="w-full max-w-sm bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-slate-800/80 border border-amber-500/40 rounded-2xl p-3 flex items-center gap-3 shadow-xl">
            <span className="text-3xl p-1.5 bg-slate-900 rounded-xl border border-amber-400/40">
              {myAbility.symbol}
            </span>
            <div className="flex flex-col text-left leading-tight flex-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <span>✨</span> SENİN GİZLİ YETENEĞİN
              </span>
              <span className="text-sm font-black text-white mt-0.5">{myAbility.name}</span>
              <span className="text-[10px] text-slate-300 mt-0.5">{myAbility.description}</span>
            </div>
            <span className="text-[9px] bg-slate-900 text-slate-400 px-2 py-1 rounded-lg border border-slate-700 font-bold">
              🔒 Gizli
            </span>
          </div>
        )}

        {/* Oyuncular Listesi */}
        <div className="w-full max-w-sm bg-slate-800/60 border border-slate-700 rounded-2xl p-4 flex flex-col gap-2.5">
          <div className="flex justify-between items-center text-xs text-slate-400 font-bold">
            <span>OYUNCULAR ({lobbyPlayers.length})</span>
            {isHost && <span className="text-amber-400 text-[10px]">👑 Oda Sahibi Sensin</span>}
          </div>

          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {lobbyPlayers.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-2xl">{animalEmoji(p.animal)}</span>
                <div className="flex flex-col flex-1 leading-tight">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm flex items-center gap-1.5">
                      {p.name}
                      {p.id === myId && <span className="text-[10px] text-sky-400 font-bold bg-sky-950 px-1.5 py-0.2 rounded border border-sky-800">Sen</span>}
                      {p.id === hostId && <span className="text-[10px] text-amber-300">👑</span>}
                    </span>
                    <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-black border border-amber-500/30 flex items-center gap-1">
                      🏆 {p.score || 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                      <span>🔒</span> Ceza: <span className="text-amber-400/90 font-bold">Gizli</span>
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                      {p.id === myId ? (
                        <span className="text-amber-300 font-bold">{myAbility?.symbol} {myAbility?.name}</span>
                      ) : (
                        <span><span>🔒</span> Yetenek: <span className="text-amber-400/90 font-bold">Gizli</span></span>
                      )}
                    </span>
                  </div>
                </div>
                {isHost && p.isBot && (
                  <button
                    onClick={() => removeBot(p.id)}
                    className="text-rose-400 hover:text-rose-300 text-xs px-2 py-1 rounded bg-rose-950/40 border border-rose-900 font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {!canStart && isHost && (
            <p className="text-center text-xs text-amber-400/90 font-medium mt-1">
              Oyuna başlamak için bir arkadaşını davet et veya Bot Ekle!
            </p>
          )}

          {!isHost && (
            <p className="text-center text-xs text-sky-300 animate-pulse mt-1">
              Oda sahibi oyunu başlatmayı bekliyor...
            </p>
          )}
        </div>

        {/* Butonlar */}
        <div className="w-full max-w-sm flex flex-col gap-2.5">
          {isHost && canAddBot && (
            <button
              onClick={addBot}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-600 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🤖</span> Bot Ekle
            </button>
          )}

          {isHost && (
            <button
              onClick={startGame}
              disabled={!canStart}
              className={`w-full py-4 font-black text-xl rounded-2xl transition-all ${
                canStart
                  ? 'bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 shadow-lg shadow-amber-500/30 cursor-pointer'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              🎮 OYUNU BAŞLAT
            </button>
          )}

          <button
            onClick={() => {
              if (globalSocket?.connected) {
                globalSocket.disconnect();
                globalSocket.connect();
              }
              setScreen('SETUP');
            }}
            className="text-xs text-slate-500 hover:text-slate-400 text-center py-1 cursor-pointer"
          >
            ← Odadan Ayrıl
          </button>
        </div>

        {error && <p className="text-rose-400 text-xs font-bold text-center">{error}</p>}
      </div>
    );
  }

  /* ── 3. EXPLODE EKRANI ────────────────────────────────────── */
  if (screen === 'EXPLODE') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-900 select-none p-4">
        <div className="text-8xl animate-bounce">💥</div>
        <div className="text-center">
          <p className="text-5xl font-black text-red-500">PATLADI!</p>
          <p className="text-2xl text-slate-200 mt-2 font-bold">
            {explodeInfo?.isMe
              ? '😱 Bomba sende patladı!'
              : `😅 ${explodeInfo?.victimName} patladı!`}
          </p>
        </div>

        {explodeInfo?.penalty && (
          <div className="mx-4 px-6 py-4 bg-rose-950/70 border border-rose-600 rounded-2xl max-w-sm text-center shadow-2xl animate-pulse">
            <p className="text-rose-400 text-xs font-black uppercase tracking-widest mb-1.5">💀 ÇEKİLECEK CEZA AÇIKLANDI</p>
            <p className="text-white text-lg font-bold leading-snug">{explodeInfo.penalty}</p>
          </div>
        )}

        <p className="text-slate-500 text-xs animate-pulse">Sonraki tur başlıyor...</p>
      </div>
    );
  }

  /* ── 4. GAMEOVER EKRANI ───────────────────────────────────── */
  if (screen === 'GAMEOVER') {
    const isMeWinner = winner?.id === myId;
    const isHost = hostId === myId || !globalSocket?.connected;

    const handleRestart = () => {
      if (globalSocket?.connected) {
        globalSocket.emit('game:reset');
        return;
      }
      setAlivePlayers(lobbyPlayers);
      aliveRef.current = lobbyPlayers;
      setRound(1);
      setWinner(null);
      setExplodeInfo(null);
      setScreen('PLAYING');
      startRoundLocal([...lobbyPlayers], 1);
    };

    const sortedLeaderboard = [...lobbyPlayers].sort((a, b) => (b.score || 0) - (a.score || 0));

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-slate-900 select-none p-4">
        <div className="text-7xl">{isMeWinner ? '🎉' : '🏆'}</div>
        <div className="text-center">
          <p className="text-3xl font-black text-amber-400 uppercase tracking-wider">OYUN BİTTİ</p>
          {winner ? (
            <>
              <p className="text-6xl my-2">{animalEmoji(winner.animal)}</p>
              <p className="text-2xl font-black text-white">{winner.name}</p>
              <p className="text-emerald-400 font-bold mt-1">
                {isMeWinner ? '🎊 Harika oynadın, kazandın!' : 'Turu kazandı!'}
              </p>
            </>
          ) : (
            <p className="text-slate-400 mt-2">Kazanan çıkmadı.</p>
          )}
        </div>

        {/* 🏆 LİDERLİK / SKOR TABLOSU */}
        <div className="w-full max-w-sm bg-slate-800/80 border border-slate-700 rounded-2xl p-4 flex flex-col gap-2 shadow-xl">
          <p className="text-xs font-black text-amber-400 uppercase tracking-widest text-center flex items-center justify-center gap-1.5">
            <span>🏆</span> SKOR TABLOSU (LİDERLİK)
          </p>
          <div className="flex flex-col gap-1.5 mt-1 max-h-48 overflow-y-auto">
            {sortedLeaderboard.map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center justify-between p-2 rounded-xl border ${
                  idx === 0
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-bold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base font-black w-6 text-center">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </span>
                  <span className="text-xl">{animalEmoji(p.animal)}</span>
                  <span className="text-sm font-bold flex items-center gap-1">
                    {p.name}
                    {p.id === myId && <span className="text-[10px] text-sky-400 font-bold bg-sky-950 px-1 py-0.2 rounded border border-sky-800">Sen</span>}
                  </span>
                </div>
                <span className="text-xs font-black bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-amber-400">
                  🏆 {p.score || 0} Zafer
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          {isHost && (
            <button
              onClick={handleRestart}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-slate-950 font-black rounded-xl transition-all shadow-lg cursor-pointer"
            >
              🔄 Tekrar Oyna
            </button>
          )}

          <button
            onClick={() => {
              setWinner(null);
              setExplodeInfo(null);
              setScreen('LOBBY');
            }}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold rounded-xl transition cursor-pointer"
          >
            🏠 Lobiye Dön
          </button>
        </div>
      </div>
    );
  }

  /* ── 5. PLAYING EKRANI ────────────────────────────────────── */
  const myCurrentScore = lobbyPlayers.find(p => p.id === myId)?.score || 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-3 bg-slate-900">
      <div className="text-xs text-slate-500 font-bold mb-1 flex items-center gap-3">
        <span>Oda: <strong className="text-amber-400 font-mono">{roomCode}</strong></span>
        <span>•</span>
        <span>Tur: <strong className="text-slate-300">#{round}</strong></span>
        <span>•</span>
        <span>Canlı: <strong className="text-emerald-400">{alivePlayers.length}</strong></span>
        <span>•</span>
        <span>Skor: <strong className="text-amber-400">🏆 {myCurrentScore}</strong></span>
      </div>

      <div className="w-full max-w-lg px-2">
        <GameArena
          state="PLAYING"
          bomb={bombState}
          players={alivePlayers}
          currentUserId={myId}
          serverOffsetMs={0}
          onPass={handlePass}
          onUseAbility={handleUseAbility}
          lastAbilityEvent={lastAbilityEvent}
        />
      </div>
    </div>
  );
}
