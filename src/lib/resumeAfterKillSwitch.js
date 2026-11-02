import { getDb } from './db.js';
import { syncChallengeEquity } from './challengeEquity.js';
import { appendWgfAuditEntry } from './wgfAuditLog.js';

/**
 * Relance le challenge après Kill Switch (ou pause sécurisée).
 */
export async function resumeAfterKillSwitch() {
  const db = getDb();
  if (!db) {
    throw new Error('SQLite indisponible.');
  }

  const row = await db.get(
    `SELECT * FROM local_challenge
     WHERE status IN ('paused', 'active')
     ORDER BY id DESC
     LIMIT 1`,
  );

  if (!row) {
    throw new Error('Aucun challenge à reprendre.');
  }

  await db.run(
    `UPDATE local_challenge SET
      status = 'active',
      failure_reason = NULL,
      anti_tilt_until = NULL
     WHERE id = ?`,
    [row.id],
  );

  const synced = await syncChallengeEquity({
    ...row,
    status: 'active',
    failure_reason: null,
    anti_tilt_until: null,
  });

  await appendWgfAuditEntry({
    challengeId: row.id,
    eventType: 'resume',
    title: 'Reprise après pause',
    detail: 'Challenge actif · anti-tilt levé',
    equity: synced?.current_equity ?? row.current_equity,
  });

  return synced ?? { ...row, status: 'active' };
}
