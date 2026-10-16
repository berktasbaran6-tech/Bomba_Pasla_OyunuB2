/**
 * PenaltyManager — Ceza Yöneticisi
 *
 * Oyuncuların ceza metinlerini saklar ve sorgulama sağlar.
 * GameEngine tarafından import edilir.
 */
export class PenaltyManager {
  constructor() {
    /** @type {Map<string, string>} playerId → penaltyText */
    this._penalties = new Map();
  }

  /**
   * Bir oyuncu için ceza metnini set eder.
   * @param {string} playerId
   * @param {string} text
   */
  setPenalty(playerId, text) {
    this._penalties.set(playerId, String(text || '').slice(0, 200));
  }

  /**
   * Oyuncunun ceza metnini döndürür. Yoksa null.
   * @param {string} playerId
   * @returns {string | null}
   */
  getPenalty(playerId) {
    return this._penalties.get(playerId) ?? null;
  }

  /**
   * Oyuncunun ceza kaydını siler.
   * @param {string} playerId
   */
  clearPenalty(playerId) {
    this._penalties.delete(playerId);
  }

  /**
   * Tüm cezaları temizler (yeni oyun başında kullanılabilir).
   */
  clearAll() {
    this._penalties.clear();
  }

  /**
   * Kayıtlı tüm cezaları döndürür (debug/log için).
   * @returns {Record<string, string>}
   */
  getAll() {
    return Object.fromEntries(this._penalties);
  }
}
