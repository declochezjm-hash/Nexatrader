import assert from 'node:assert/strict';
import {
  buildWgfPhaseReadiness,
  collectWgfProactiveAlerts,
  computeFundedPayoutSimulation,
} from '../src/lib/wgfPhaseReadiness.js';

const evalChallenge = {
  id: 1,
  status: 'active',
  wgf_program_id: 'wgf_2step_phase1',
  initial_balance: 100_000,
  current_equity: 108_000,
  profit_target_percent: 8,
  max_daily_loss_percent: 5,
  max_overall_loss_percent: 10,
};

const trades = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map((d) => ({
  status: 'closed',
  pnl: 1600,
  created_at: `${d}T12:00:00.000Z`,
}));

const readiness = buildWgfPhaseReadiness(evalChallenge, trades, 108_000);
assert.equal(readiness.evaluationReady, true);
assert.ok(readiness.items.some((i) => i.id === 'profit' && i.status === 'ok'));

const funded = {
  ...evalChallenge,
  wgf_program_id: 'wgf_funded',
  profit_target_percent: 0,
  current_equity: 105_000,
};
const payout = computeFundedPayoutSimulation(funded, 105_000, 80);
assert.equal(payout.traderPayout, 4000);
assert.equal(payout.applies, true);

const alerts = collectWgfProactiveAlerts({
  challenge: evalChallenge,
  trades,
  propGuard: { maxOverall: 10, overallDrawdownPct: 2 },
});
assert.ok(Array.isArray(alerts));

console.log('wgfPhaseReadiness: OK');
