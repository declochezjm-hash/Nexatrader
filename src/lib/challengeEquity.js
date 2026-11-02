import { getDb } from './db.js';
import {
  computeEquityFromTrades,
  shouldFailChallenge,
  nextAntiTiltUntil,
  ANTI_TILT_LOSS_THRESHOLD,
} from '../engine/propGuard.js';
import { evaluateDailyReset } from './wgfDailyReset.js';
import { evaluateProfitTargetPass } from './wgfProfitTarget.js';
import {
  challengeUsesEodTrailing,
  computeInitialEodFloor,
  evaluateEodMidnightRollover,
} from './wgfEodTrailing.js';
import { getGmtDateKey } from './wgfDailyReset.js';
import { appendWgfAuditEntry } from './wgfAuditLog.js';

export async function fetchAllTradesForEquity() {
  const db = getDb();
  if (!db) return [];
  return db.query(
    `SELECT id, pnl, status, type, symbol, lot_size, entry_price, created_at FROM trades`,
  );
}

async function persistChallengeEquityFields(db, challengeId, fields) {
  const sets = [];
  const params = [];
  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = ?`);
    params.push(value);
  }
  params.push(challengeId);
  await db.run(`UPDATE local_challenge SET ${sets.join(', ')} WHERE id = ?`, params);
}

/**
 * Recalcule l'équité et met à jour local_challenge ; passe en FAILED si limites WGF dépassées.
 */
export async function syncChallengeEquity(challenge) {
  const db = getDb();
  if (!db || !challenge?.id) return challenge;

  const trades = await fetchAllTradesForEquity();
  const equity = computeEquityFromTrades(challenge, trades);

  if (challenge.status === 'failed') {
    return { ...challenge, current_equity: equity, last_equity_snapshot: equity };
  }

  if (challenge.status === 'passed') {
    await persistChallengeEquityFields(db, challenge.id, {
      current_equity: equity,
      last_equity_snapshot: equity,
    });
    return { ...challenge, current_equity: equity, last_equity_snapshot: equity };
  }

  let working = challenge;
  let eodMessage = null;
  let dailyMessage = null;

  const eodEval = evaluateEodMidnightRollover(working, equity);
  if (eodEval.apply) {
    await persistChallengeEquityFields(db, challenge.id, {
      eod_trailing_floor: eodEval.newFloor,
      last_eod_process_gmt: eodEval.todayKey,
      last_equity_snapshot: equity,
    });
    working = eodEval.challenge;
    eodMessage = eodEval.message;
    await appendWgfAuditEntry({
      challengeId: challenge.id,
      eventType: 'eod_rollover',
      title: 'Plancher EOD recalculé',
      detail: eodMessage,
      equity,
    });
  }

  const resetEval = evaluateDailyReset(working, equity);
  if (resetEval.apply) {
    await persistChallengeEquityFields(db, challenge.id, {
      starting_daily_balance: equity,
      last_daily_reset_gmt: resetEval.todayKey,
      current_equity: equity,
      last_equity_snapshot: equity,
    });
    working = resetEval.challenge;
    dailyMessage = resetEval.message;
    await appendWgfAuditEntry({
      challengeId: challenge.id,
      eventType: 'daily_reset',
      title: 'Reset journalier 00:00 GMT',
      detail: dailyMessage,
      equity,
    });
  }

  const failCheck = shouldFailChallenge(working, equity);

  if (failCheck.fail) {
    await db.run(
      `UPDATE local_challenge SET
        current_equity = ?,
        last_equity_snapshot = ?,
        status = 'failed',
        failure_reason = ?
       WHERE id = ?`,
      [equity, equity, failCheck.reason, challenge.id],
    );
    await appendWgfAuditEntry({
      challengeId: challenge.id,
      eventType: 'phase_fail',
      title: 'Challenge FAILED',
      detail: failCheck.reason,
      equity,
    });
    return {
      ...working,
      current_equity: equity,
      last_equity_snapshot: equity,
      status: 'failed',
      failure_reason: failCheck.reason,
    };
  }

  const passCheck = evaluateProfitTargetPass(working, equity, trades);
  if (passCheck.pass) {
    await db.run(
      `UPDATE local_challenge SET
        current_equity = ?,
        last_equity_snapshot = ?,
        status = 'passed',
        pass_reason = ?,
        failure_reason = NULL
       WHERE id = ?`,
      [equity, equity, passCheck.message, challenge.id],
    );
    await appendWgfAuditEntry({
      challengeId: challenge.id,
      eventType: 'phase_pass',
      title: 'Objectif WGF atteint',
      detail: passCheck.message,
      equity,
    });
    return {
      ...working,
      current_equity: equity,
      last_equity_snapshot: equity,
      status: 'passed',
      pass_reason: passCheck.message,
      failure_reason: null,
      _profitPassMessage: passCheck.message,
      _profitPassNext: passCheck.nextPhase,
    };
  }

  await persistChallengeEquityFields(db, working.id, {
    current_equity: equity,
    last_equity_snapshot: equity,
  });

  return {
    ...working,
    current_equity: equity,
    last_equity_snapshot: equity,
    _eodResetMessage: eodMessage,
    _dailyResetMessage: dailyMessage,
  };
}

export async function registerClosedTradePnl(tradeId, pnl, challenge, exitPrice = null) {
  const db = getDb();
  if (!db) return challenge;

  if (exitPrice != null) {
    await db.run(`UPDATE trades SET pnl = ?, exit_price = ?, status = 'closed' WHERE id = ?`, [
      pnl,
      exitPrice,
      tradeId,
    ]);
  } else {
    await db.run(`UPDATE trades SET pnl = ?, status = 'closed' WHERE id = ?`, [pnl, tradeId]);
  }

  const isLoss = pnl < 0;
  let consecutive = challenge?.consecutive_losses ?? 0;
  let antiTiltUntil = challenge?.anti_tilt_until ?? null;

  if (isLoss) {
    consecutive += 1;
    if (consecutive >= ANTI_TILT_LOSS_THRESHOLD) {
      antiTiltUntil = nextAntiTiltUntil();
    }
  } else if (pnl > 0) {
    consecutive = 0;
    antiTiltUntil = null;
  }

  await db.run(
    `UPDATE local_challenge SET consecutive_losses = ?, anti_tilt_until = ? WHERE id = ?`,
    [consecutive, antiTiltUntil, challenge.id],
  );

  const updated = {
    ...challenge,
    consecutive_losses: consecutive,
    anti_tilt_until: antiTiltUntil,
  };

  return syncChallengeEquity(updated);
}

export function buildChallengeTrackingFields(programId, initialBalance) {
  const balance = Number(initialBalance);
  const today = getGmtDateKey();
  const stub = { wgf_program_id: programId, initial_balance: balance };
  return {
    last_daily_reset_gmt: today,
    last_eod_process_gmt: today,
    last_equity_snapshot: balance,
    eod_trailing_floor: challengeUsesEodTrailing(stub) ? computeInitialEodFloor(stub) : null,
  };
}
