import { getDb, WGF_READY_DEFAULTS } from './db.js';

/**
 * Garantit un challenge exploitable (paper / démo) après onboarding.
 */
export async function ensureActiveChallenge(appSettings) {
  const db = getDb();
  if (!db) return null;

  const onboarded = Number(appSettings?.first_launch_completed) === 1;
  if (!onboarded) return null;

  let row = await db.get(
    `SELECT * FROM local_challenge
     WHERE status IN ('active', 'paused')
     ORDER BY id DESC
     LIMIT 1`,
  );

  const paperTrading = appSettings?.paper_trading == null || Number(appSettings.paper_trading) === 1;

  if (row?.status === 'paused' && paperTrading) {
    await db.run(
      `UPDATE local_challenge SET
        status = 'active',
        failure_reason = NULL
       WHERE id = ?`,
      [row.id],
    );
    row = { ...row, status: 'active', failure_reason: null };
  }

  if (row) return row;

  const balance = 100_000;
  const wgf = WGF_READY_DEFAULTS;
  const result = await db.run(
    `INSERT INTO local_challenge (
      status, initial_balance, current_equity, starting_daily_balance,
      profit_target_percent, max_daily_loss_percent, max_overall_loss_percent,
      consecutive_losses, failure_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    [
      'active',
      balance,
      balance,
      balance,
      wgf.profit_target_percent,
      wgf.max_daily_loss_percent,
      wgf.max_overall_loss_percent,
    ],
  );

  return db.get('SELECT * FROM local_challenge WHERE id = ?', [result.lastInsertRowid]);
}
