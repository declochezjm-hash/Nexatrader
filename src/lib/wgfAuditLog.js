import { getDb } from './db.js';

/**
 * @typedef {'phase_pass' | 'phase_fail' | 'daily_reset' | 'eod_rollover' | 'phase_advance' | 'challenge_new' | 'kill_switch' | 'resume' | 'program_change' | 'one_day_pass_on' | 'one_day_pass_off'} WgfAuditEventType
 */

export const WGF_AUDIT_EVENT_LABELS = {
  phase_pass: 'Phase validée',
  phase_fail: 'Challenge failed',
  daily_reset: 'Reset journalier GMT',
  eod_rollover: 'Recalcul plancher EOD',
  phase_advance: 'Passage de phase',
  challenge_new: 'Nouveau challenge',
  kill_switch: 'Kill Switch',
  resume: 'Reprise trading',
  program_change: 'Programme WGF',
  one_day_pass_on: 'One Day Pass activé',
  one_day_pass_off: 'One Day Pass désactivé',
};

/**
 * @param {object} params
 * @param {number|null|undefined} params.challengeId
 * @param {WgfAuditEventType} params.eventType
 * @param {string} params.title
 * @param {string|null|undefined} [params.detail]
 * @param {number|null|undefined} [params.equity]
 */
export async function appendWgfAuditEntry({
  challengeId,
  eventType,
  title,
  detail = null,
  equity = null,
}) {
  const db = getDb();
  if (!db) return null;

  const result = await db.run(
    `INSERT INTO wgf_audit_log (challenge_id, event_type, title, detail, equity)
     VALUES (?, ?, ?, ?, ?)`,
    [challengeId ?? null, eventType, title, detail, equity],
  );
  notifyWgfAuditUpdated();
  return result?.lastInsertRowid ?? null;
}

/**
 * @param {number|null|undefined} challengeId
 * @param {number} [limit]
 */
export async function fetchWgfAuditLog(challengeId, limit = 80) {
  const db = getDb();
  if (!db) return [];

  if (challengeId) {
    return db.query(
      `SELECT id, challenge_id, event_type, title, detail, equity, created_at
       FROM wgf_audit_log
       WHERE challenge_id = ?
       ORDER BY id DESC
       LIMIT ?`,
      [challengeId, limit],
    );
  }

  return db.query(
    `SELECT id, challenge_id, event_type, title, detail, equity, created_at
     FROM wgf_audit_log
     ORDER BY id DESC
     LIMIT ?`,
    [limit],
  );
}

export function formatAuditEventType(eventType) {
  return WGF_AUDIT_EVENT_LABELS[eventType] ?? eventType;
}

function notifyWgfAuditUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nexatrader:wgf-audit-updated'));
  }
}

/**
 * Première entrée pour un challenge sans historique (comptes déjà existants).
 * @param {object|null|undefined} challenge
 */
export async function ensureWgfAuditBootstrap(challenge) {
  if (!challenge?.id) return;
  const existing = await fetchWgfAuditLog(challenge.id, 1);
  if (existing.length > 0) return;

  await appendWgfAuditEntry({
    challengeId: challenge.id,
    eventType: 'challenge_new',
    title: 'Point de départ audit WGF',
    detail: `Programme ${challenge.wgf_program_id ?? '—'} · statut ${challenge.status} · capital ${Number(challenge.initial_balance ?? 0).toFixed(0)} $`,
    equity: challenge.current_equity ?? challenge.initial_balance,
  });
  notifyWgfAuditUpdated();
}
