import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { AnimalCharacter } from './AnimalCharacter';
import { Bomb } from './Bomb';
import { Countdown } from './countdown';
import { getAbilityById } from './abilities';

export function GameArena({
  state,
  bomb,
  players = [],
  currentUserId,
  serverOffsetMs = 0,
  onPass,
  onUseAbility,
  lastAbilityEvent = null,
}) {
  const isExploding = state === 'EXPLODING';

  const [remainingTotal, setRemainingTotal] = useState(120);
  const [remainingLock,  setRemainingLock]  = useState(0);
  const [passFeedback,   setPassFeedback]   = useState(null);

  // Yetenek Durumları
  const [targetingAbility, setTargetingAbility] = useState(null); // Hedef seçimi bekleyen yetenek
  const [floatingSymbols,  setFloatingSymbols]  = useState({});     // playerId -> { symbol, expiresAt }
  const [xrayActiveUntil,  setXrayActiveUntil]  = useState(0);      // Zaman Röntgeni süresi

  const audioCtxRef   = useRef(null);
  const feedbackTimer = useRef(null);
  const alarmTimerRef = useRef(null);
  const isNearRef     = useRef(false);

  // Mevcut Oyuncu Bilgileri
  const me = players.find(p => p.id === currentUserId);
  const myAbility = getAbilityById(me?.abilityId);
  const isAbilityReady = !!me?.abilityReady;
  const bombTouches = me?.bombTouchesAfterUse || 0;
  const isMeFrozen = me ? (me.frozen || Date.now() < (me.frozenUntil || 0)) : false;
  const remainingFreeze = me?.frozenUntil ? Math.max(0, (me.frozenUntil - Date.now()) / 1000) : 0;

  const isHolding = !!bomb && bomb.holderId === currentUserId;
  const isMeEliminated = me ? me.alive === false : false;
  const panicThreshold = bomb?.panicThresholdSec || 24;
  const isNearExplosion = remainingTotal <= panicThreshold && state === 'PLAYING';
  const canPassNow = !isMeEliminated && isHolding && remainingLock <= 0 && !isExploding && !isMeFrozen;

  useEffect(() => {
    isNearRef.current = isNearExplosion;
  }, [isNearExplosion]);

  /* ── 1 Saniyelik Sembol Animasyonunu Yakalama ─────────────────── */
  useEffect(() => {
    if (!lastAbilityEvent) return;
    const { playerId, symbol } = lastAbilityEvent;
    if (!playerId || !symbol) return;

    setFloatingSymbols(prev => ({
      ...prev,
      [playerId]: { symbol, expiresAt: Date.now() + 1000 }
    }));

    const timer = setTimeout(() => {
      setFloatingSymbols(prev => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [lastAbilityEvent]);

  /* ── Ses Motoru (Web Audio API) ─────────────────────────────── */
  const playAlarmTone = useCallback((isUrgent = false) => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      if (isUrgent) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1050, now);
        osc.frequency.linearRampToValueAtTime(1400, now + 0.08);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);

        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(180, now);
        subOsc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
        subGain.gain.setValueAtTime(0.15, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        subOsc.connect(subGain);
        subGain.connect(ctx.destination);
        subOsc.start(now);
        subOsc.stop(now + 0.1);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.07);

        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch {
      /* ses sessiz */
    }
  }, []);

  /* ── Sürekli Alarm Sesi Döngüsü ────────────────────────────── */
  useEffect(() => {
    if (state !== 'PLAYING' || !bomb) {
      clearTimeout(alarmTimerRef.current);
      return;
    }

    let isRunning = true;
    const runAlarmLoop = () => {
      if (!isRunning) return;
      const urgent = isNearRef.current;
      playAlarmTone(urgent);
      const interval = urgent ? 240 : 800;
      alarmTimerRef.current = setTimeout(runAlarmLoop, interval);
    };

    runAlarmLoop();
    return () => {
      isRunning = false;
      clearTimeout(alarmTimerRef.current);
    };
  }, [state, bomb, playAlarmTone]);

  /* ── Zamanlayıcı Takibi (100 ms) ────────────────────────────── */
  useEffect(() => {
    if (!bomb || state !== 'PLAYING') {
      setRemainingTotal(120);
      setRemainingLock(0);
      return;
    }
    const tick = () => {
      const now   = Date.now() + serverOffsetMs;
      const total = Math.max(0, (bomb.totalEndsAt - now) / 1000);
      const lock  = Math.max(0, ((bomb.lockEndsAt || 0) - now) / 1000);

      setRemainingTotal(total);
      setRemainingLock(lock);
    };

    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [bomb, state, serverOffsetMs]);

  /* ── Feedback Bildirimleri ──────────────────────────────────── */
  const showFeedback = useCallback((type, msg) => {
    setPassFeedback({ type, msg });
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setPassFeedback(null), 1800);
  }, []);

  /* ── Cleanup ────────────────────────────────────────────────── */
  useEffect(() => () => {
    clearTimeout(feedbackTimer.current);
    clearTimeout(alarmTimerRef.current);
    audioCtxRef.current?.close().catch(() => {});
  }, []);

  /* ── Yetenek Kullanımı ──────────────────────────────────────── */
  const triggerAbility = useCallback((targetId = null) => {
    if (!myAbility || !isAbilityReady) {
      showFeedback('warn', 'Yeteneğin henüz hazır değil!');
      return;
    }
    if (isMeFrozen) {
      showFeedback('error', 'Donmuşken yetenek kullanamazsın! 🥶');
      return;
    }

    if (myAbility.requiresBomb && !isHolding) {
      showFeedback('warn', 'Bu yetenek sadece bomba sendeyken kullanılır!');
      return;
    }

    if (myAbility.needsTarget && !targetId) {
      setTargetingAbility(myAbility);
      showFeedback('warn', `🎯 ${myAbility.name} için bir oyuncuya tıkla!`);
      return;
    }

    if (myAbility.id === 'xray') {
      setXrayActiveUntil(Date.now() + 3000);
    }

    setTargetingAbility(null);
    if (typeof onUseAbility === 'function') {
      onUseAbility(myAbility.id, targetId);
    }
    showFeedback('success', `✨ ${myAbility.symbol} ${myAbility.name} kullanıldı!`);
  }, [myAbility, isAbilityReady, isMeFrozen, isHolding, onUseAbility, showFeedback]);

  /* ── Rastgele Pas Butonu ─────────────────────────────────────── */
  const handleRandomPass = useCallback(() => {
    if (state !== 'PLAYING' || !isHolding) return;
    if (isMeFrozen) {
      showFeedback('error', `🥶 Donmuş durumdasın! ${Math.ceil(remainingFreeze)}s bekle!`);
      return;
    }
    if (remainingLock > 0) {
      showFeedback('error', `🔒 Pas kilidi! ${Math.ceil(remainingLock)}s bekle!`);
      return;
    }
    if (typeof onPass === 'function') {
      onPass(null);
      showFeedback('success', '🎲 Rastgele pas yapıldı!');
    }
  }, [state, isHolding, isMeFrozen, remainingFreeze, remainingLock, onPass, showFeedback]);

  /* ── Hedef Oyuncuya Tıklama (Pas veya Yetenek) ──────────────── */
  const handlePlayerClick = useCallback((targetPlayer) => {
    if (state !== 'PLAYING') return;
    if (targetPlayer.alive === false) {
      showFeedback('warn', `${targetPlayer.name} elendi!`);
      return;
    }

    // Hedef seçimi modundaysak yeteneği uygula!
    if (targetingAbility) {
      if (targetPlayer.id === currentUserId && targetingAbility.id !== 'mirror') {
        showFeedback('warn', 'Kendini hedef seçemezsin!');
        return;
      }
      triggerAbility(targetPlayer.id);
      return;
    }

    // Normal Pas
    if (targetPlayer.id === currentUserId) return;

    if (!isHolding) {
      showFeedback('warn', 'Bomba şu an sende değil!');
      return;
    }

    if (isMeFrozen) {
      showFeedback('error', `🥶 Donmuş durumdasın! ${Math.ceil(remainingFreeze)}s bekle!`);
      return;
    }

    if (remainingLock > 0) {
      showFeedback('error', `🔒 Pas kilidi! ${Math.ceil(remainingLock)}s bekle!`);
      return;
    }

    if (typeof onPass === 'function') {
      onPass(targetPlayer.id);
      showFeedback('success', `🎯 ${targetPlayer.name} oyuncusuna atıldı!`);
    }
  }, [state, targetingAbility, currentUserId, isHolding, isMeFrozen, remainingFreeze, remainingLock, triggerAbility, onPass, showFeedback]);

  /* SPACE tuşu */
  useEffect(() => {
    const fn = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        handleRandomPass();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [handleRandomPass]);

  /* ── Daire Pozisyonları ──────────────────────────────────────── */
  const CONTAINER = 340;
  const RADIUS    = 120;
  const CX        = CONTAINER / 2;
  const CY        = CONTAINER / 2;

  const positions = useMemo(() => players.map((_, i) => {
    const angle = (2 * Math.PI * i / players.length) - Math.PI / 2;
    return {
      x: CX + RADIUS * Math.cos(angle),
      y: CY + RADIUS * Math.sin(angle),
    };
  }), [players.length]);

  const isXrayActive = Date.now() < xrayActiveUntil;

  /* ─── RENDER ─────────────────────────────────────────────────── */
  return (
    <div className="w-full flex flex-col items-center gap-2.5 py-1 select-none">

      {/* Durum Göstergesi (Normalde gizli; Röntgen aktifse sayı görünür!) */}
      {isXrayActive ? (
        <div className="px-5 py-2 bg-cyan-950/90 border-2 border-cyan-400 rounded-2xl text-center shadow-2xl animate-pulse">
          <p className="text-[10px] font-black text-cyan-300 uppercase tracking-widest flex items-center justify-center gap-1">
            <span>👁️</span> ZAMAN RÖNTGENİ AKTİF!
          </p>
          <p className="text-2xl font-black font-mono text-cyan-200">
            {remainingTotal.toFixed(1)} sn kaldı!
          </p>
        </div>
      ) : (
        <Countdown
          isNearExplosion={isNearExplosion}
          remainingLockSec={remainingLock}
          isHolding={isHolding}
        />
      )}

      {/* Bomba elindeyken ipucu */}
      {canPassNow && !targetingAbility && (
        <div className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-[11px] font-bold text-amber-300 animate-pulse">
          👉 Bir oyuncuya tıkla ya da alttan Rastgele Pasla!
        </div>
      )}

      {/* Hedef Seçme Modu Bildirimi */}
      {targetingAbility && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-rose-950 border border-rose-500 rounded-xl text-xs font-black text-rose-300 animate-bounce">
          <span>🎯 {targetingAbility.symbol} {targetingAbility.name}: Hedef bir oyuncuya tıkla!</span>
          <button
            onClick={() => setTargetingAbility(null)}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10px]"
          >
            İptal
          </button>
        </div>
      )}

      {/* ── DAİRE ALAN ─────────────────────────────────────────── */}
      <div
        className="relative my-1"
        style={{ width: CONTAINER, height: CONTAINER }}
      >
        <svg
          className="absolute inset-0 opacity-15"
          width={CONTAINER}
          height={CONTAINER}
        >
          <circle
            cx={CX} cy={CY} r={RADIUS}
            fill="none"
            stroke={isNearExplosion ? '#ef4444' : '#94a3b8'}
            strokeWidth={isNearExplosion ? '2' : '1'}
            strokeDasharray="6 4"
          />
        </svg>

        {/* Merkezdeki Bomba */}
        {bomb && !isExploding && (
          <div
            className="absolute"
            style={{
              left: CX,
              top:  CY,
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
            }}
          >
            <Bomb
              isNearExplosion={isNearExplosion}
              isJammed={remainingLock > 0}
              isExploding={false}
              size={75}
            />
          </div>
        )}

        {/* Patlama Anı */}
        {isExploding && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-8xl animate-ping">💥</span>
          </div>
        )}

        {/* Daire Üzerindeki Oyuncular */}
        {players.map((player, i) => {
          const isDead = player.alive === false;
          const hasBomb = !isDead && !!bomb && bomb.holderId === player.id;
          const isVictimExploding = isExploding && hasBomb;
          const pos     = positions[i];
          const isTargetableForPass = !isDead && canPassNow && player.id !== currentUserId && !targetingAbility;
          const isTargetableForAbility = !isDead && !!targetingAbility && player.id !== currentUserId;
          const isClickable = isTargetableForPass || isTargetableForAbility;

          const isPlayerFrozen = !isDead && (player.frozen || Date.now() < (player.frozenUntil || 0));
          const activeSymbol = floatingSymbols[player.id];

          return (
            <div
              key={player.id}
              onClick={() => handlePlayerClick(player)}
              className={`absolute flex flex-col items-center gap-0.5 transition-all duration-300 ${
                isClickable
                  ? 'cursor-pointer hover:scale-125 active:scale-95 group'
                  : ''
              }`}
              style={{
                left:      pos.x,
                top:       pos.y,
                transform: 'translate(-50%, -50%)',
                zIndex:    hasBomb ? 25 : isClickable ? 20 : isDead ? 2 : 5,
              }}
            >
              {/* 1 Saniyelik Parlayan Güç Sembolü Efekti */}
              {activeSymbol && !isDead && (
                <div className="absolute -top-12 z-50 pointer-events-none animate-bounce">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-900/95 border-2 border-amber-400 shadow-2xl shadow-amber-400/80 text-2xl scale-125">
                    {activeSymbol.symbol}
                  </div>
                </div>
              )}

              {/* Bomba İkonu */}
              {hasBomb && !isExploding && (
                <span className="text-lg animate-bounce -mb-1">💣</span>
              )}

              {/* Hedef Rozetleri */}
              {isTargetableForAbility && (
                <span className="text-[10px] bg-rose-500 text-slate-950 px-2 py-0.5 rounded-full font-black -mb-1 shadow animate-bounce">
                  SEÇ!
                </span>
              )}

              {isTargetableForPass && (
                <span className="text-[10px] bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded-full font-black -mb-1 shadow animate-bounce">
                  AT!
                </span>
              )}

              <div className={`relative ${
                isTargetableForAbility
                  ? 'ring-4 ring-rose-400 ring-offset-2 ring-offset-slate-900 rounded-full animate-pulse'
                  : isTargetableForPass
                  ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-slate-900 rounded-full animate-pulse'
                  : ''
              }`}>
                <AnimalCharacter
                  animal={player.animal}
                  name={player.name}
                  hasBomb={hasBomb}
                  isYou={player.id === currentUserId}
                  isFrozen={isPlayerFrozen}
                  isEliminated={isDead}
                  isExploding={isVictimExploding}
                />
              </div>

              <div className="flex items-center gap-1">
                <span className={`text-[11px] font-bold whitespace-nowrap px-1 rounded flex items-center gap-1 ${
                  isDead
                    ? 'text-slate-500 bg-slate-900/90'
                    : hasBomb
                    ? 'text-amber-300 bg-amber-950/60'
                    : isClickable
                    ? 'text-emerald-300 group-hover:text-emerald-200'
                    : 'text-slate-400'
                }`}>
                  {isDead && <span>💀</span>}
                  {isPlayerFrozen && !isDead && <span>❄️</span>}
                  <span className={isDead ? 'line-through opacity-75' : ''}>{player.name}</span>
                  {player.id === currentUserId ? ' (Sen)' : ''}
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-full font-bold border border-amber-500/30">
                  🏆{player.score || 0}
                </span>
              </div>
              {isDead && (
                <span className="text-[9px] font-black text-rose-400 bg-rose-950/90 border border-rose-800/80 px-1.5 rounded-full uppercase tracking-tighter shadow -mt-0.5 animate-pulse">
                  💨 Elendi
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Bildirim Toast */}
      {passFeedback && (
        <div className={`px-4 py-1.5 rounded-2xl text-xs font-bold shadow-lg animate-bounce border ${
          passFeedback.type === 'error'
            ? 'bg-rose-900/90 text-rose-200 border-rose-700'
            : passFeedback.type === 'warn'
            ? 'bg-amber-900/90 text-amber-200 border-amber-700'
            : 'bg-emerald-900/90 text-emerald-200 border-emerald-700'
        }`}>
          {passFeedback.msg}
        </div>
      )}

      {/* ── 🪞 AYNA YETENEĞİ ÖZEL UYARI POPUP'I ─────────────────── */}
      {myAbility?.id === 'mirror' && isHolding && isAbilityReady && bomb?.lastHolderId && (
        <div className="w-full max-w-sm px-4">
          <div className="w-full bg-gradient-to-r from-indigo-950 to-purple-950 border-2 border-indigo-400 p-3 rounded-2xl flex items-center justify-between shadow-2xl shadow-indigo-500/30 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="text-3xl">🪞</span>
              <div className="text-left">
                <p className="text-xs font-black text-indigo-300 uppercase">AYNA YETENEĞİ HAZIR!</p>
                <p className="text-[11px] text-slate-300">Bombayı atan kişiye anında geri yansıt?</p>
              </div>
            </div>
            <button
              onClick={() => triggerAbility()}
              className="px-3.5 py-2 bg-indigo-500 hover:bg-indigo-400 active:scale-95 text-slate-950 font-black rounded-xl text-xs shadow-lg transition cursor-pointer whitespace-nowrap"
            >
              🪞 GERİ YANSIT!
            </button>
          </div>
        </div>
      )}

      {/* ── YETENEK KONTROLÜ VE PAS BUTONU ────────────────────────── */}
      <div className="w-full max-w-md px-4 flex flex-col items-center gap-2">
        {/* Özel Yetenek Barı */}
        {myAbility && (
          <div className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-slate-800/80 border border-slate-700 shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="text-3xl p-1 bg-slate-900/80 rounded-xl border border-slate-700">
                {myAbility.symbol}
              </span>
              <div className="flex flex-col text-left">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  {myAbility.name}
                  {isAbilityReady ? (
                    <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-700 px-1.5 py-0.2 rounded-full font-bold">
                      HAZIR
                    </span>
                  ) : (
                    <span className="text-[9px] bg-slate-900 text-slate-400 border border-slate-700 px-1.5 py-0.2 rounded-full font-bold">
                      Şarj: {bombTouches}/2 Bomba
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                  {isAbilityReady ? myAbility.description : 'Bomba 2. kez sana geldiğinde açılacak!'}
                </span>
              </div>
            </div>

            <button
              onClick={() => triggerAbility()}
              disabled={!isAbilityReady || isMeFrozen || (myAbility.requiresBomb && !isHolding)}
              className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all shadow-md flex items-center gap-1 whitespace-nowrap ${
                isAbilityReady && (!myAbility.requiresBomb || isHolding) && !isMeFrozen
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95 cursor-pointer shadow-amber-500/20 animate-pulse'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-60'
              }`}
            >
              <span>{myAbility.symbol}</span>
              <span>KULLAN</span>
            </button>
          </div>
        )}

        {/* Ana Pas Butonu */}
        <button
          onClick={handleRandomPass}
          disabled={isMeEliminated || !isHolding || isExploding || isMeFrozen}
          className={`w-full py-3.5 rounded-2xl font-black text-lg tracking-wider uppercase transition-all duration-150 shadow-xl border-b-4 ${
            isMeEliminated
              ? 'bg-rose-950/80 text-rose-300 border-rose-900/80 cursor-not-allowed opacity-90'
              : isMeFrozen
              ? 'bg-cyan-700 text-cyan-100 border-cyan-900 opacity-90 cursor-not-allowed animate-pulse'
              : isHolding
              ? remainingLock > 0
                ? 'bg-amber-600 text-amber-100 border-amber-800 opacity-90 cursor-not-allowed animate-pulse'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-700 active:translate-y-1 active:border-b-0 cursor-pointer animate-bounce-soft'
              : 'bg-slate-800 text-slate-500 border-slate-900 opacity-50 cursor-not-allowed'
          }`}
        >
          {isMeEliminated
            ? <span>💥 ELENDİN (OYUN İZLENİYOR...)</span>
            : isMeFrozen
            ? <span>🥶 DONDU! ({Math.ceil(remainingFreeze)}s BEKLE)</span>
            : isHolding
            ? remainingLock > 0
              ? <span>🔒 KİLİTLİ ({Math.ceil(remainingLock)}s BEKLE)</span>
              : <span>🎲 RASTGELE PASLA</span>
            : <span>Sıra sende değil...</span>
          }
        </button>

        <div className="text-center text-xs text-slate-500 leading-relaxed">
          <span>Karakterlere tıklayarak <strong className="text-emerald-400">istediğin kişiye</strong> atabilir veya </span>
          <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-amber-400 font-mono font-bold">SPACE</kbd>
          <span> ile <strong className="text-amber-400">rastgele</strong> paslayabilirsin.</span>
        </div>
      </div>
    </div>
  );
}
