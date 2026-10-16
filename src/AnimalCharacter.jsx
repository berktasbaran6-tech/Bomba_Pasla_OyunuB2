/**
 * AnimalCharacter — Oyuncunun hayvan karakterini gösteren bileşen
 */
export function AnimalCharacter({ animal = 'rabbit', name = '', hasBomb = false, isYou = false, isFrozen = false }) {
  const emoji = ANIMAL_EMOJIS[animal] ?? '🐾';

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center
        w-16 h-16 rounded-full text-4xl
        transition-all duration-200 select-none
        ${isFrozen ? 'ring-4 ring-cyan-400 bg-cyan-950/60 shadow-lg shadow-cyan-400/50 animate-pulse' : ''}
        ${hasBomb && !isFrozen ? 'ring-4 ring-red-500 ring-offset-2 ring-offset-slate-900 scale-110' : ''}
        ${isYou && !hasBomb && !isFrozen ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-900' : ''}
      `}
      title={name}
      aria-label={`${name} karakteri: ${emoji}`}
    >
      <span role="img" aria-hidden="true" className={isFrozen ? 'opacity-80' : ''}>{emoji}</span>

      {/* Donma İkonu */}
      {isFrozen && (
        <span className="absolute -top-1 -right-1 text-lg animate-spin-slow">❄️</span>
      )}

      {/* Bomba taşıyanın uyarı halkası */}
      {hasBomb && (
        <span className="absolute -bottom-1 -right-1 text-base animate-bounce">💣</span>
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
