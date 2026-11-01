import { getDb, fetchActiveChallenge, WGF_READY_DEFAULTS } from './db.js';

export async function updateActiveChallengeLimits({
  profitTargetPercent,
  maxDailyLossPercent,
  maxOverallLossPercent,
}) {
  const db = getDb();
  if (!db) throw new Error('SQLite indisponible.');

  const ch = await fetchActiveChallenge();
  if (!ch?.id) throw new Error('Aucun challenge actif à mettre à jour.');

  await db.run(
    `UPDATE local_challenge SET
      profit_target_percent = ?,
      max_daily_loss_percent = ?,
      max_overall_loss_percent = ?
     WHERE id = ?`,
    [profitTargetPercent, maxDailyLossPercent, maxOverallLossPercent, ch.id],
  );

  return fetchActiveChallenge();
}

export async function resetChallengeWithCapital({
  initialBalance,
  profitTargetPercent = WGF_READY_DEFAULTS.profit_target_percent,
  maxDailyLossPercent = WGF_READY_DEFAULTS.max_daily_loss_percent,
  maxOverallLossPercent = WGF_READY_DEFAULTS.max_overall_loss_percent,
}) {
  const db = getDb();
  if (!db) throw new Error('SQLite indisponible.');

  const balance = Number(initialBalance);
  if (!Number.isFinite(balance) || balance <= 0) {
    throw new Error('Capital initial invalide.');
  }

  await db.run(`UPDATE local_challenge SET status = 'archived' WHERE status IN ('active', 'paused')`);

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
      profitTargetPercent,
      maxDailyLossPercent,
      maxOverallLossPercent,
    ],
  );

  return db.get('SELECT * FROM local_challenge WHERE id = ?', [result.lastInsertRowid]);
}
