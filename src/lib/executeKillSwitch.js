import { getDb } from './db.js';
import { estimatePnl } from '../engine/positionSizer.js';
import { syncChallengeEquity } from './challengeEquity.js';
import { recordPatternOutcome } from './patternMemory.js';
import { appendWgfAuditEntry } from './wgfAuditLog.js';

/**
 * Kill Switch global — clôture d'urgence 100 % des ordres ouverts.
 */
export async function executeKillSwitch({
  marketPricesBySymbol = {},
  reason = 'Kill Switch',
  patternByTradeId = {},
  fallbackPattern = null,
}) {
  const db = getDb();
  if (!db) {
    return { ok: false, closed: 0, error: 'SQLite indisponible.' };
  }

  const openTrades = await db.query(
    `SELECT * FROM trades WHERE status IN ('open', 'pending') ORDER BY id ASC`,
  );

  let totalPnl = 0;
  for (const trade of openTrades) {
    const exit =
      marketPricesBySymbol[trade.symbol] ??
      trade.entry_price ??
      trade.exit_price ??
      0;

    const pnl =
      trade.entry_price != null
        ? estimatePnl({
            symbol: trade.symbol,
            type: trade.type,
            lotSize: trade.lot_size,
            entryPrice: trade.entry_price,
            exitPrice: exit,
          })
        : 0;

    totalPnl += pnl;

    await db.run(
      `UPDATE trades SET
        exit_price = ?,
        pnl = ?,
        status = 'emergency_closed'
       WHERE id = ?`,
      [exit, pnl, trade.id],
    );

    const pattern = patternByTradeId[trade.id] ?? fallbackPattern;
    if (pattern) {
      await recordPatternOutcome(
        { ...pattern, symbol: pattern.symbol ?? trade.symbol },
        pnl >= 0 ? 'WIN' : 'LOSS',
      );
    }
  }

  const challenge = await db.get(
    `SELECT * FROM local_challenge WHERE status = 'active' ORDER BY id DESC LIMIT 1`,
  );

  if (challenge) {
    await db.run(
      `UPDATE local_challenge SET
        status = 'paused',
        failure_reason = ?,
        anti_tilt_until = datetime('now', '+45 minutes')
       WHERE id = ?`,
      [reason, challenge.id],
    );
    await appendWgfAuditEntry({
      challengeId: challenge.id,
      eventType: 'kill_switch',
      title: 'Kill Switch activé',
      detail: `${reason} · ${openTrades.length} position(s) clôturée(s)`,
      equity: challenge.current_equity,
    });
    await syncChallengeEquity({ ...challenge, status: 'paused' });
  }

  return {
    ok: true,
    closed: openTrades.length,
    totalPnl: Number(totalPnl.toFixed(2)),
    reason,
  };
}
