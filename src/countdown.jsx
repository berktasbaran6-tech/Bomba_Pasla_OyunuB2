import React from 'react';

/**
 * Countdown — Gerilim ve Durum Göstergesi (Rakamla geri sayım gizli)
 */
export function Countdown({
  isNearExplosion = false,
  remainingLockSec = 0,
  isHolding = false
}) {
  const lockSec = Math.max(0, remainingLockSec);

  return (
    <div className="flex flex-col items-center gap-1.5 select-none my-1">
      {/* Gerilim başlığı (toplam süre rakamı GİZLİ) */}
      <div className={`px-4 py-1.5 rounded-full font-black text-sm tracking-wider uppercase border transition-all ${
        isNearExplosion
          ? 'bg-red-950/80 text-red-400 border-red-600 animate-pulse shadow-lg shadow-red-900/40'
          : 'bg-slate-800/80 text-amber-400 border-slate-700'
      }`}>
        {isNearExplosion ? '🚨 DİKKAT! PATLAMA ÇOK YAKIN! 🚨' : '💣 Bomba Aktif · Her An Patlayabilir!'}
      </div>

      {/* Bomba bendeyse kilit / pas durumu */}
      {isHolding && (
        <div className="flex items-center gap-3 mt-0.5">
          {lockSec > 0 ? (
            <span className="text-xs font-bold text-amber-400 bg-amber-950/70 border border-amber-700/60 px-3 py-1 rounded-full animate-pulse">
              🔒 Pas Kilidi: {Math.ceil(lockSec)}s
            </span>
          ) : (
            <span className="text-xs font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-700/60 px-3 py-1 rounded-full">
              ✨ Şimdi Paslayabilirsin!
            </span>
          )}
        </div>
      )}
    </div>
  );
}
