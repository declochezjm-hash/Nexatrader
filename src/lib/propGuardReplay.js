import { computeEquityFromTrades, computeDrawdowns, shouldFailChallenge, canOpenTrade } from '../engine/propGuard.js';

const CLOSED = new Set(['closed', 'emergency_closed']);

/**
 * Timeline PropGuard : équité et drawdowns après chaque trade clôturé.
 * @param {object|null|undefined} challenge
 * @param {Array<object>} trades
 */
export function buildPropGuardReplayTimeline(challenge, trades = []) {
  if (!challenge?.id) return { frames: [], error: 'Aucun challenge actif.' };

  const closed = [...trades]
    .filter((t) => CLOSED.has(String(t.status ?? '').toLowerCase()))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  /** @type {Array<object>} */
  const frames = [];
  let cumulative = [];

  frames.push({
    index: 0,
    label: 'Départ challenge',
    tradeId: null,
    equity: Number(challenge.initial_balance ?? 0),
    drawdowns: computeDrawdowns({
      ...challenge,
      current_equity: challenge.initial_balance,
    }),
    fail: { fail: false },
    gateSample: null,
  });

  for (let i = 0; i < closed.length; i += 1) {
    cumulative = [...cumulative, closed[i]];
    const equity = computeEquityFromTrades(challenge, cumulative);
    const ch = { ...challenge, current_equity: equity };
    const drawdowns = computeDrawdowns(ch);
    const fail = shouldFailChallenge(ch, equity);
    const gateSample = canOpenTrade({
      symbol: closed[i].symbol ?? 'XAUUSD',
      currentSpread: 0.2,
      challenge: ch,
      inSession: true,
      killSwitchActive: false,
      paperTrading: true,
      wgfEnforcementMode: 'conservative',
    });

    frames.push({
      index: i + 1,
      label: `Après trade #${closed[i].id}`,
      tradeId: closed[i].id,
      pnl: closed[i].pnl,
      equity,
      drawdowns,
      fail,
      gateSample: {
        allowed: gateSample.allowed,
        reasons: gateSample.reasons?.slice(0, 2) ?? [],
      },
    });
  }

  return { frames, total: frames.length };
}
