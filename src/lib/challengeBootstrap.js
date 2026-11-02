import { getDb } from './db.js';
import { DEFAULT_WGF_PROGRAM_ID, limitsForProgram } from './wgfPrograms.js';
import { buildChallengeTrackingFields } from './challengeEquity.js';
import { getWgfProgram } from './wgfPrograms.js';
import { appendWgfAuditEntry } from './wgfAuditLog.js';

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
  const wgf = limitsForProgram(DEFAULT_WGF_PROGRAM_ID);
  const program = DEFAULT_WGF_PROGRAM_ID;
  const track = buildChallengeTrackingFields(program, balance);
  const result = await db.run(
    `INSERT INTO local_challenge (
      status, initial_balance, current_equity, starting_daily_balance,
      profit_target_percent, max_daily_loss_percent, max_overall_loss_percent,
      wgf_program_id, wgf_phase, last_daily_reset_gmt,
      last_eod_process_gmt, last_equity_snapshot, eod_trailing_floor,
      consecutive_losses, failure_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    [
      'active',
      balance,
      balance,
      balance,
      wgf.profit_target_percent,
      wgf.max_daily_loss_percent,
      wgf.max_overall_loss_percent,
      program,
      1,
      track.last_daily_reset_gmt,
      track.last_eod_process_gmt,
      track.last_equity_snapshot,
      track.eod_trailing_floor,
    ],
  );

  const newRow = await db.get('SELECT * FROM local_challenge WHERE id = ?', [result.lastInsertRowid]);
  const prog = getWgfProgram(program);
  await appendWgfAuditEntry({
    challengeId: newRow.id,
    eventType: 'challenge_new',
    title: `Challenge démo ${prog.shortLabel}`,
    detail: `Bootstrap auto · capital ${balance.toLocaleString('fr-FR')} $`,
    equity: balance,
  });

  return newRow;
}
