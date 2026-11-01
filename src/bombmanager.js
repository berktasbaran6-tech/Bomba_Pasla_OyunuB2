/**
 * Bomba Yöneticisi (Bomb Manager)
 *
 * Kurallar:
 * 1. Toplam bomba süresi tur başında 1 ile 3 dakika (60 - 180 sn) arası rastgele başlar.
 *    Süre dolduğunda bomba kimin elindeyse onda patlar.
 * 2. Oyuncunun elinde tutma sınırı YOKTUR! İstediği kadar tutabilir.
 * 3. Pas kilidi: Bomba bir oyuncuya geçtiğinde 1 ile 10 sn arası rastgele kilitlenir.
 * 4. Panik alarmı eşiği: 12 ile 30 sn arasında rastgele belirlenir.
 * 5. Yetenek Entegrasyonu:
 *    - resetLock(): Kilidi anında sıfırlar (Kilit Kırıcı / Adrenalin).
 *    - reduceTotalTime(ms): Toplam süreden 10 sn siler, 10 sn altındaysa anında patlatır (Zaman Hızlandırıcı).
 *    - lastHolderId: Ayna (Bumerang) yeteneği için bombayı az önce atan oyuncuyu tutar.
 */

const TOTAL_MIN_SEC = 60;  // 1 dakika
const TOTAL_MAX_SEC = 180; // 3 dakika
const LOCK_MIN_SEC = 1.2;
const LOCK_MAX_SEC = 3.8;   // Dengeli ve dinamik pas kilidi (1.2 - 3.8 sn)

export class BombManager {
  constructor(onExplodeCallback) {
    this.onExplode = onExplodeCallback;

    this.holderId = null;
    this.lastHolderId = null;
    this.active = false;

    // Toplam süre (tur başında 1-3 dakika arası rastgele seçilir)
    this.totalDurationMs = 60000;
    this.roundStartedAt = 0;
    this.totalExpiresAt = 0;
    this.totalTimer = null;

    // Panik alarmının başlayacağı rastgele eşik (12 - 30 saniye arası)
    this.panicThresholdSec = 25;

    // Pas yasağı (her pasta 1-10 sn arası yeniden seçilir)
    this.lockDurationMs = 0;
    this.unlockAt = 0;
  }

  /**
   * Yeni tur: 1 ile 3 dakika (60-180 sn) arası rastgele bir toplam süre belirler ve başlatır.
   * @param {string} starterId
   */
  startRound(starterId) {
    this.clearAllTimers();

    const now = Date.now();
    this.active = true;
    this.lastHolderId = null;
    this.roundStartedAt = now;

    // 1 ile 3 dakika (60 - 180 sn) arası tamamen rastgele toplam süre
    const randomTotalSec = Math.floor(Math.random() * (TOTAL_MAX_SEC - TOTAL_MIN_SEC + 1)) + TOTAL_MIN_SEC;
    this.totalDurationMs = randomTotalSec * 1000;
    this.totalExpiresAt = now + this.totalDurationMs;

    // Panik alarmının devreye gireceği an: 12 ile 30 saniye arasında rastgele!
    this.panicThresholdSec = Math.floor(Math.random() * (30 - 12 + 1)) + 12;

    this.totalTimer = setTimeout(
      () => this._explode('TOTAL_TIMEOUT'),
      this.totalDurationMs
    );

    this._giveToPlayer(starterId, now);
  }

  /**
   * Bombayı aktarmayı dener.
   * @param {string} fromId  aktaran oyuncu
   * @param {string} toId    alacak oyuncu
   * @param {{ force?: boolean }} [opts]
   * @returns {{ ok: boolean, reason?: string, remainingLockMs?: number }}
   */
  passBomb(fromId, toId, opts = {}) {
    if (!this.active) return { ok: false, reason: 'NOT_ACTIVE' };
    if (!opts.force && this.holderId !== fromId) return { ok: false, reason: 'NOT_HOLDER' };
    if (fromId === toId) return { ok: false, reason: 'SAME_PLAYER' };

    const now = Date.now();
    if (!opts.force && now < this.unlockAt) {
      return {
        ok: false,
        reason: 'LOCKED',
        remainingLockMs: this.unlockAt - now
      };
    }

    this.lastHolderId = fromId;
    this._giveToPlayer(toId, now);
    return { ok: true };
  }

  /**
   * Kilit Kırıcı yeteneği: Mevcut kilidi anında 0 yapar.
   */
  resetLock() {
    this.unlockAt = Date.now();
  }

  /**
   * Zaman Hızlandırıcı yeteneği: Süreden 10 sn siler, 10 sn'den azsa anında patlatır.
   * @param {number} ms (varsayılan 10000ms = 10sn)
   * @returns {{ remainingMs: number, exploded: boolean }}
   */
  reduceTotalTime(ms = 10000) {
    if (!this.active) return { remainingMs: 0, exploded: false };

    const now = Date.now();
    this.totalExpiresAt -= ms;
    clearTimeout(this.totalTimer);

    const remaining = this.totalExpiresAt - now;
    if (remaining <= 0) {
      this._explode('SPEEDUP_EXPLODE');
      return { remainingMs: 0, exploded: true };
    }

    this.totalTimer = setTimeout(
      () => this._explode('TOTAL_TIMEOUT'),
      remaining
    );
    return { remainingMs: remaining, exploded: false };
  }

  /**
   * İstemciye gönderilecek anlık durum.
   */
  getState() {
    return {
      holderId: this.holderId,
      lastHolderId: this.lastHolderId,
      active: this.active,
      totalEndsAt: this.totalExpiresAt,
      lockEndsAt: this.unlockAt,
      panicThresholdSec: this.panicThresholdSec,
      serverNow: Date.now()
    };
  }

  /** Turu sonlandırır */
  stop() {
    this.active = false;
    this.holderId = null;
    this.lastHolderId = null;
    this.clearAllTimers();
  }

  clearAllTimers() {
    if (this.totalTimer) clearTimeout(this.totalTimer);
    this.totalTimer = null;
  }

  // --- İç yardımcılar ---------------------------------------------------

  _giveToPlayer(playerId, now) {
    this.holderId = playerId;

    // 1-10 sn arası rastgele pas kilidi (max 10 saniye!)
    const lockSec = Math.floor(Math.random() * (LOCK_MAX_SEC - LOCK_MIN_SEC + 1)) + LOCK_MIN_SEC;
    this.lockDurationMs = lockSec * 1000;
    this.unlockAt = now + this.lockDurationMs;
  }

  _explode(reason) {
    if (!this.active) return;
    const victimId = this.holderId;
    this.active = false;
    this.clearAllTimers();
    if (typeof this.onExplode === 'function') {
      this.onExplode({ victimId, reason });
    }
  }
}
