import React, { useEffect, useRef } from 'react';

/**
 * Bomb — Bomba görsel bileşeni
 *
 * Props:
 *  isNearExplosion  : boolean  — Son 30 saniyeye girildi mi? (hızlı fitil, titreme)
 *  isJammed         : boolean  — Pas kilidi aktif mi? (sarı/kırmızı yanıp sönme)
 *  isExploding      : boolean  — Patlama anı (💥)
 *  size             : number   — Boyut (px)
 */
export function Bomb({
  isNearExplosion = false,
  isJammed = false,
  isExploding = false,
  size = 75
}) {
  const shakeRef = useRef(null);

  // Son 30 saniyede titre
  useEffect(() => {
    if (isNearExplosion && !isExploding) {
      shakeRef.current?.classList.add('bomb-shake');
    } else {
      shakeRef.current?.classList.remove('bomb-shake');
    }
  }, [isNearExplosion, isExploding]);

  if (isExploding) {
    return (
      <div
        style={{ width: size * 1.5, height: size * 1.5 }}
        className="flex items-center justify-center text-7xl animate-ping"
        aria-label="Bomba patladı"
      >
        💥
      </div>
    );
  }

  const fuseColor = isNearExplosion ? '#ef4444' : isJammed ? '#f59e0b' : '#fbbf24';

  const bodyClass = isNearExplosion
    ? 'animate-pulse'
    : isJammed
    ? 'opacity-85'
    : '';

  return (
    <div
      ref={shakeRef}
      style={{ width: size, height: size }}
      className={`relative flex items-center justify-center select-none ${bodyClass}`}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Fitil */}
        <path
          d="M52 22 Q68 6 82 16"
          stroke={fuseColor}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        {/* Fitil kıvılcımı */}
        <circle cx="83" cy="15" r={isNearExplosion ? 6 : 4} fill={fuseColor}>
          <animate
            attributeName="opacity"
            values="1;0.2;1"
            dur={isNearExplosion ? '0.2s' : '0.5s'}
            repeatCount="indefinite"
          />
        </circle>
        {/* Gövde */}
        <circle
          cx="50"
          cy="62"
          r="32"
          fill={isNearExplosion ? '#450a0a' : isJammed ? '#3b1d08' : '#1e293b'}
          stroke={fuseColor}
          strokeWidth={isNearExplosion ? 4 : 3}
        />
        {/* Bomba boynu */}
        <rect x="44" y="28" width="12" height="8" rx="3" fill="#475569" />
        {/* Bomba parıltısı / ikon */}
        <circle cx="40" cy="52" r="6" fill="#ffffff" opacity="0.15" />
      </svg>

      {/* Kilit ikonu */}
      {isJammed && (
        <div className="absolute -top-1 -right-1 text-base animate-bounce">🔒</div>
      )}

      {/* Son 30 saniye tehlike ikonu */}
      {isNearExplosion && !isJammed && (
        <div className="absolute -top-2 -right-2 text-base animate-ping">⚠️</div>
      )}

      <style>{`
        .bomb-shake {
          animation: bomb-shake-anim 0.2s infinite;
        }
        @keyframes bomb-shake-anim {
          0%, 100% { transform: translateX(0); }
          25%       { transform: translateX(-3px) rotate(-2deg); }
          75%       { transform: translateX(3px)  rotate(2deg); }
        }
      `}</style>
    </div>
  );
}
