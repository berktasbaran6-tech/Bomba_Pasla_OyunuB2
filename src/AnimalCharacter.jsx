/**
 * AnimalCharacter — Oyuncunun hayvan karakterini gösteren bileşen
 */
export function AnimalCharacter({
  animal = 'rabbit',
  name = '',
  hasBomb = false,
  isYou = false,
  isFrozen = false,
  isEliminated = false,
  isExploding = false
}) {
  const emoji = ANIMAL_EMOJIS[animal] ?? '🐾';

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center
        w-16 h-16 rounded-full text-4xl
        transition-all duration-300 select-none
        ${isExploding ? 'scale-125 ring-8 ring-amber-500 bg-red-600/60 shadow-2xl shadow-red-500/80 animate-pulse' : ''}
        ${isEliminated ? 'filter contrast-125 brightness-75 animate-dizzy-wobble ring-2 ring-slate-700 bg-slate-900/90 shadow-inner' : ''}
        ${isFrozen && !isEliminated ? 'ring-4 ring-cyan-400 bg-cyan-950/60 shadow-lg shadow-cyan-400/50 animate-pulse' : ''}
        ${hasBomb && !isFrozen && !isEliminated && !isExploding ? 'ring-4 ring-red-500 ring-offset-2 ring-offset-slate-900 scale-110 shadow-lg shadow-red-500/50' : ''}
        ${isYou && !hasBomb && !isFrozen && !isEliminated ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-900' : ''}
      `}
      title={name}
      aria-label={`${name} karakteri: ${emoji}`}
    >
      {/* ── 💥 PATLAMA ANINDA ŞOK DALGASI VE ALEV EFEKTİ ── */}
      {isExploding && (
        <div className="absolute inset-0 -m-5 flex items-center justify-center pointer-events-none z-40">
          <span className="text-6xl animate-explosion-burst select-none">💥</span>
        </div>
      )}

      {/* ── 💫 KAFASINDA UÇUŞAN YILDIZLAR (Dizzy Stars) ── */}
      {isEliminated && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-6 pointer-events-none z-30 flex items-center justify-center">
          <span className="absolute text-sm animate-orbit-star-1 select-none">⭐</span>
          <span className="absolute text-xs animate-orbit-star-2 select-none">✨</span>
          <span className="absolute text-base animate-orbit-star-3 select-none">💫</span>
        </div>
      )}

      {/* ── 💨 ÜSTÜNDEN TÜTEN DUMAN BULUTLARI (Smoke Plumes) ── */}
      {isEliminated && (
        <div className="absolute -top-4 inset-x-0 flex justify-center items-center pointer-events-none z-20 overflow-visible">
          <span className="absolute text-base animate-smoke-1 opacity-80 -left-1 select-none">💨</span>
          <span className="absolute text-sm animate-smoke-2 opacity-75 select-none">☁️</span>
          <span className="absolute text-xs animate-smoke-3 opacity-90 right-0 select-none">💨</span>
        </div>
      )}

      {/* Karakter Emojisi (Patlamışsa Yanmış/Kömürleşmiş İs Efekti) */}
      <span
        role="img"
        aria-hidden="true"
        className={`relative z-10 transition-all ${
          isEliminated
            ? 'opacity-70 filter grayscale contrast-150 brightness-50'
            : isFrozen
            ? 'opacity-80'
            : ''
        }`}
      >
        {emoji}
      </span>

      {/* İs ve Kurum Kaplaması */}
      {isEliminated && (
        <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none z-10" />
      )}

      {/* Donma İkonu */}
      {isFrozen && !isEliminated && (
        <span className="absolute -top-1 -right-1 text-lg animate-spin-slow z-20">❄️</span>
      )}

      {/* Bomba taşıyanın uyarı halkası */}
      {hasBomb && !isEliminated && !isExploding && (
        <span className="absolute -bottom-1 -right-1 text-base animate-bounce z-20">💣</span>
      )}
    </div>
  );
}

const ANIMAL_EMOJIS = {
  rabbit : '🐰',
  cat    : '🐱',
  dog    : '🐶',
  fox    : '🦊',
  bear   : '🐻',
  panda  : '🐼',
  lion   : '🦁',
  tiger  : '🐯',
  monkey : '🐵',
  frog   : '🐸',
  penguin: '🐧',
  owl    : '🦉',
};
