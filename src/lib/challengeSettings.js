import { getDb, fetchActiveChallenge } from './db.js';
import {
  DEFAULT_WGF_PROGRAM_ID,
  getWgfProgram,
  limitsForProgram,
} from './wgfPrograms.js';
import { getGmtDateKey } from './wgfDailyReset.js';
import {
  challengeUsesEodTrailing,
  computeInitialEodFloor,
} from './wgfEodTrailing.js';
import { buildChallengeTrackingFields } from './challengeEquity.js';
import { getNextWgfProgramId } from './wgfProfitTarget.js';
import { appendWgfAuditEntry } from './wgfAuditLog.js';
import { isOneDayPassEligible } from './wgfOneDayPass.js';

export { DEFAULT_WGF_PROGRAM_ID, limitsForProgram };

/** @deprecated Préférez limitsForProgram(DEFAULT_WGF_PROGRAM_ID) */
export const WGF_READY_DEFAULTS = limitsForProgram(DEFAULT_WGF_PROGRAM_ID);

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

/**
 * Applique un profil WGF au challenge actif (limites + métadonnées programme).
 * @param {string} programId
 */
export async function applyWgfProgramToActiveChallenge(programId) {
  const db = getDb();
  if (!db) throw new Error('SQLite indisponible.');

  const ch = await fetchActiveChallenge();
  if (!ch?.id) throw new Error('Aucun challenge actif.');

  const program = getWgfProgram(programId);
  const limits = limitsForProgram(programId);
  const merged = {
    ...ch,
    wgf_program_id: program.id,
    max_overall_loss_percent: limits.max_overall_loss_percent,
  };
  const usesEod = challengeUsesEodTrailing({ wgf_program_id: program.id });
  const eodFloor = usesEod ? computeInitialEodFloor(merged) : null;
  const snapshot = Number(ch.current_equity ?? ch.initial_balance ?? 0);

  await db.run(
    `UPDATE local_challenge SET
      wgf_program_id = ?,
      wgf_phase = ?,
      profit_target_percent = ?,
      max_daily_loss_percent = ?,
      max_overall_loss_percent = ?,
      eod_trailing_floor = ?,
      last_eod_process_gmt = CASE WHEN ? = 1 THEN ? ELSE last_eod_process_gmt END,
      last_equity_snapshot = ?,
      one_day_pass = CASE WHEN ? = 1 THEN one_day_pass ELSE 0 END
     WHERE id = ?`,
    [
      program.id,
      program.phase ?? 1,
      limits.profit_target_percent,
      limits.max_daily_loss_percent,
      limits.max_overall_loss_percent,
      eodFloor,
      usesEod ? 1 : 0,
      getGmtDateKey(),
      snapshot,
      isOneDayPassEligible({ wgf_program_id: program.id }) ? 1 : 0,
      ch.id,
    ],
  );

  await appendWgfAuditEntry({
    challengeId: ch.id,
    eventType: 'program_change',
    title: `Programme WGF : ${program.shortLabel}`,
    detail: program.id,
    equity: snapshot,
  });

  return fetchActiveChallenge();
}

/**
 * Active ou désactive l’option WGF One Day Pass (1 Step uniquement).
 * @param {boolean} enabled
 */
export async function setOneDayPassOnActiveChallenge(enabled) {
  const db = getDb();
  if (!db) throw new Error('SQLite indisponible.');

  const ch = await fetchActiveChallenge();
  if (!ch?.id) throw new Error('Aucun challenge actif.');

  if (!isOneDayPassEligible(ch)) {
    throw new Error('One Day Pass disponible uniquement sur le programme WGF 1 Step.');
  }

  const flag = enabled ? 1 : 0;
  if (Number(ch.one_day_pass) === flag) return ch;

  await db.run(`UPDATE local_challenge SET one_day_pass = ? WHERE id = ?`, [flag, ch.id]);

  await appendWgfAuditEntry({
    challengeId: ch.id,
    eventType: enabled ? 'one_day_pass_on' : 'one_day_pass_off',
    title: enabled ? 'One Day Pass activé' : 'One Day Pass désactivé',
    detail: enabled
      ? 'Jours minimum : 1 · règle de consistency désactivée (alignement WGF).'
      : 'Retour aux règles standard 1 Step (2 jours min., consistency 50 %).',
    equity: ch.current_equity ?? ch.initial_balance,
  });

  return fetchActiveChallenge();
}

/**
 * Passe à la phase WGF suivante après statut `passed` (capital inchangé, nouvelles limites).
 */
export async function advanceWgfPhaseAfterPass() {
  const db = getDb();
  if (!db) throw new Error('SQLite indisponible.');

  const ch = await fetchActiveChallenge();
  if (!ch?.id) throw new Error('Aucun challenge en cours.');
  if (ch.status !== 'passed') {
    throw new Error('L’objectif de profit n’est pas encore validé (statut passed requis).');
  }

  const nextId = getNextWgfProgramId(ch);
  if (!nextId) throw new Error('Aucune phase suivante pour ce programme.');

  const program = getWgfProgram(nextId);
  const limits = limitsForProgram(nextId);
  const equity = Number(ch.current_equity ?? ch.initial_balance ?? 0);
  const track = buildChallengeTrackingFields(nextId, ch.initial_balance);
  const merged = {
    ...ch,
    wgf_program_id: nextId,
    initial_balance: ch.initial_balance,
    max_overall_loss_percent: limits.max_overall_loss_percent,
  };
  const usesEod = challengeUsesEodTrailing({ wgf_program_id: nextId });
  const eodFloor = usesEod ? computeInitialEodFloor(merged) : null;

  await db.run(
    `UPDATE local_challenge SET
      status = 'active',
      pass_reason = NULL,
      failure_reason = NULL,
      wgf_program_id = ?,
      wgf_phase = ?,
      profit_target_percent = ?,
      max_daily_loss_percent = ?,
      max_overall_loss_percent = ?,
      starting_daily_balance = ?,
      last_daily_reset_gmt = ?,
      eod_trailing_floor = ?,
      last_eod_process_gmt = ?,
      last_equity_snapshot = ?,
      consecutive_losses = 0,
      anti_tilt_until = NULL,
      one_day_pass = CASE WHEN ? = 1 THEN one_day_pass ELSE 0 END
     WHERE id = ?`,
    [
      program.id,
      program.phase ?? 1,
      limits.profit_target_percent,
      limits.max_daily_loss_percent,
      limits.max_overall_loss_percent,
      equity,
      track.last_daily_reset_gmt,
      eodFloor,
      track.last_eod_process_gmt,
      equity,
      isOneDayPassEligible({ wgf_program_id: nextId }) ? 1 : 0,
      ch.id,
    ],
  );

  await appendWgfAuditEntry({
    challengeId: ch.id,
    eventType: 'phase_advance',
    title: `Passage vers ${program.shortLabel}`,
    detail: `Programme ${program.id} · équité ${equity.toFixed(0)} $`,
    equity,
  });

  return fetchActiveChallenge();
}

/**
 * @param {object} params
 * @param {number} params.initialBalance
 * @param {string} [params.programId]
 * @param {number} [params.profitTargetPercent]
 * @param {number} [params.maxDailyLossPercent]
 * @param {number} [params.maxOverallLossPercent]
 */
export async function resetChallengeWithCapital({
  initialBalance,
  programId = DEFAULT_WGF_PROGRAM_ID,
  profitTargetPercent,
  maxDailyLossPercent,
  maxOverallLossPercent,
}) {
  const db = getDb();
  if (!db) throw new Error('SQLite indisponible.');

  const balance = Number(initialBalance);
  if (!Number.isFinite(balance) || balance <= 0) {
    throw new Error('Capital initial invalide.');
  }

  const program = getWgfProgram(programId);
  const defaults = limitsForProgram(programId);
  const profit = profitTargetPercent ?? defaults.profit_target_percent;
  const daily = maxDailyLossPercent ?? defaults.max_daily_loss_percent;
  const overall = maxOverallLossPercent ?? defaults.max_overall_loss_percent;

  await db.run(
    `UPDATE local_challenge SET status = 'archived'
     WHERE status IN ('active', 'paused', 'passed')`,
  );

  const track = buildChallengeTrackingFields(program.id, balance);
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
      profit,
      daily,
      overall,
      program.id,
      program.phase ?? 1,
      track.last_daily_reset_gmt,
      track.last_eod_process_gmt,
      track.last_equity_snapshot,
      track.eod_trailing_floor,
    ],
  );

  const newId = result.lastInsertRowid;
  await appendWgfAuditEntry({
    challengeId: newId,
    eventType: 'challenge_new',
    title: 'Nouveau challenge WGF',
    detail: `${program.shortLabel} · capital ${balance.toFixed(0)} $`,
    equity: balance,
  });

  return db.get('SELECT * FROM local_challenge WHERE id = ?', [newId]);
}
