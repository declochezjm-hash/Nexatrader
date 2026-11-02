import assert from 'node:assert/strict';
import { pnlForBalancePercent, runWgfWhatIfScenario } from '../src/lib/wgfWhatIf.js';

const challenge = {
  id: 1,
  status: 'active',
  wgf_program_id: 'wgf_2step_phase1',
  initial_balance: 100_000,
  current_equity: 100_000,
  starting_daily_balance: 100_000,
  profit_target_percent: 8,
  max_daily_loss_percent: 5,
  max_overall_loss_percent: 10,
};

const baseTrades = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'].map((d) => ({
  status: 'closed',
  pnl: 1000,
  created_at: `${d}T12:00:00.000Z`,
}));

assert.equal(pnlForBalancePercent(challenge, 8), 8000);

const failDd = runWgfWhatIfScenario({
  challenge,
  trades: [],
  additionalPnl: -10_000,
  countAsTradingDay: false,
  scenarioDate: new Date('2026-11-05T12:00:00.000Z'),
});
assert.equal(failDd.ok, true);
assert.equal(failDd.fail.fail, true);

const passProfit = runWgfWhatIfScenario({
  challenge,
  trades: baseTrades,
  additionalPnl: 4000,
  countAsTradingDay: true,
  scenarioDate: new Date('2026-11-05T12:00:00.000Z'),
});
assert.equal(passProfit.ok, true);
assert.equal(passProfit.profit.reached, true);
assert.equal(passProfit.compliance.minDays.met, true);

const bigDay = runWgfWhatIfScenario({
  challenge,
  trades: baseTrades,
  additionalPnl: 5000,
  countAsTradingDay: true,
  scenarioDate: new Date('2026-11-05T12:00:00.000Z'),
});
assert.equal(bigDay.profit.reached, true);
assert.equal(bigDay.passEval.pass, false);
assert.ok(bigDay.compliance.consistency.compliant === false);

console.log('wgfWhatIf: OK');
