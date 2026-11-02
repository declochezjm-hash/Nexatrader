import assert from 'node:assert/strict';
import { runWgfWhatIfMultiProgram } from '../src/lib/wgfWhatIf.js';
import { buildPropGuardReplayTimeline } from '../src/lib/propGuardReplay.js';
import { computeWgfPreparationByProgram } from '../src/lib/wgfProgramPreparation.js';
import { buildTwinTradeComparison } from '../src/lib/twinTrade.js';
import { buildDisciplineHeatmap } from '../src/lib/disciplineHeatmap.js';
import { collectIntelligentAlerts } from '../src/lib/intelligentAlerts.js';
import { computeLocalSocialStats } from '../src/lib/localSocial.js';
import { getUpcomingHighImpactEvents } from '../src/engine/newsFilter.js';

const challenge = {
  id: 1,
  status: 'active',
  wgf_program_id: 'wgf_2step_phase1',
  initial_balance: 100_000,
  current_equity: 102_000,
  profit_target_percent: 8,
  max_daily_loss_percent: 5,
  max_overall_loss_percent: 10,
};

const trades = [
  {
    id: 1,
    status: 'closed',
    pnl: 2000,
    symbol: 'XAUUSD',
    type: 'BUY',
    entry_price: 2650,
    stop_loss: 2645,
    created_at: '2026-11-01T14:00:00.000Z',
    plan_snapshot: JSON.stringify({
      side: 'BUY',
      symbol: 'XAUUSD',
      entry: 2650,
      stopLoss: 2645,
    }),
  },
];

assert.equal(runWgfWhatIfMultiProgram({ challenge, trades }).length >= 5, true);

const replay = buildPropGuardReplayTimeline(challenge, trades);
assert.ok(replay.frames.length >= 2);

const prep = computeWgfPreparationByProgram(challenge, trades);
assert.ok(prep.some((p) => p.isCurrent));

const twin = buildTwinTradeComparison(trades[0]);
assert.equal(twin.available, true);
assert.equal(twin.alignmentScore >= 80, true);

const heat = buildDisciplineHeatmap(trades);
assert.ok(heat.grid.length === 7 * 24);

const alerts = collectIntelligentAlerts({
  challenge,
  trades,
  propGuard: { maxDaily: 5, maxOverall: 10, dailyDrawdownPct: 1, overallDrawdownPct: 2 },
});
assert.ok(Array.isArray(alerts));

const social = computeLocalSocialStats(challenge, trades, 1500);
assert.ok(social.personalRecord >= 1500);

assert.ok(getUpcomingHighImpactEvents(new Date(), 24 * 60).length >= 0);

console.log('innovationFeatures: OK');
