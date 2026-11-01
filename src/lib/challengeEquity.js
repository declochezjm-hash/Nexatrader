import { getDb } from './db.js';
import {
  computeEquityFromTrades,
  shouldFailChallenge,
  nextAntiTiltUntil,
  ANTI_TILT_LOSS_THRESHOLD,
} from '../engine/propGuard.js';
import { estimatePnl } from '../engine/positionSizer.js';

export async function fetchAllTradesForEquity() {
  const db = getDb();
  if (!db) return [];
  return db.query(`SELECT id, pnl, status, type, symbol, lot_size, entry_price FROM trades`);
}

/**
 * Recalcule l'équité et met à jour local_challenge ; passe en FAILED si limites WGF dépassées.
 */
export async function syncChallengeEquity(challenge) {
  const db = getDb();
  if (!db || !challenge?.id) return challenge;

  const trades = await fetchAllTradesForEquity();
  const equity = computeEquityFromTrades(challenge, trades);
  const failCheck = shouldFailChallenge(challenge, equity);

  if (failCheck.fail) {
    await db.run(
      `UPDATE local_challenge SET
        current_equity = ?,
        status = 'failed',
        failure_reason = ?
       WHERE id = ?`,
      [equity, failCheck.reason, challenge.id],
    );
    return {
      ...challenge,
      current_equity: equity,
      status: 'failed',
      failure_reason: failCheck.reason,
    };
  }

  await db.run(`UPDATE local_challenge SET current_equity = ? WHERE id = ?`, [
    equity,
    challenge.id,
  ]);

  return { ...challenge, current_equity: equity };
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
