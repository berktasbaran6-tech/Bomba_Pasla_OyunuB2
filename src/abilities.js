/**
 * Bomba Oyunu - Özel Yetenekler Konfigürasyonu
 */

export const ABILITIES = [
  {
    id: 'adrenaline',
    name: 'Kilit Kırıcı',
    symbol: '⚡',
    description: 'Pas kilidini anında 0 yapar, bombayı beklemeden fırlatırsın!',
    needsTarget: false,
    requiresBomb: true,
  },
  {
    id: 'mirror',
    name: 'Ayna (Geri İade)',
    symbol: '🪞',
    description: 'Bomba sana geldiğinde anında geri seker, atan kişiye döner!',
    needsTarget: false,
    requiresBomb: true,
  },
  {
    id: 'freeze',
    name: 'Buz Küpü',
    symbol: '🧊',
    description: 'Seçtiğin bir oyuncuyu 5 saniyeliğine dondurur (hareketsiz kalır, pas atamaz)!',
    needsTarget: true,
    requiresBomb: false,
  },
  {
    id: 'magnet',
    name: 'Mıknatıs',
    symbol: '🧲',
    description: 'Bombayı tutanın bir sonraki pasını seçtiğin hedefe zorlar!',
    needsTarget: true,
    requiresBomb: false,
  },
  {
    id: 'speedup',
    name: 'Zaman Hızlandırıcı',
    symbol: '⏩',
    description: 'Gizli süreden 10 saniye siler! 10 sn altındaysa bomba anında patlar!',
    needsTarget: false,
    requiresBomb: false,
  },
  {
    id: 'xray',
    name: 'Zaman Röntgeni',
    symbol: '👁️',
    description: 'Patlamaya kaç saniye kaldığını 3 saniyeliğine sadece sana gösterir!',
    needsTarget: false,
    requiresBomb: false,
  },
  {
    id: 'swap',
    name: 'Yer Değiştirme',
    symbol: '🔀',
    description: 'Seçtiğin biriyle yer değiştirip bombayı anında ona bırakırsın!',
    needsTarget: true,
    requiresBomb: true,
  },
];

export function getRandomAbility() {
  const item = ABILITIES[Math.floor(Math.random() * ABILITIES.length)];
  return { ...item };
}

export function getAbilityById(id) {
  return ABILITIES.find(a => a.id === id) || null;
}
