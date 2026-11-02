import assert from 'node:assert/strict';
import {
  aggregateDailyPnlByGmt,
  computeWgfComplianceStatus,
  countWgfTradingDays,
  evaluateConsistencyRule,
  evaluateMinTradingDays,
} from '../src/lib/wgfCompliance.js';
import { evaluateProfitTargetPass } from '../src/lib/wgfProfitTarget.js';

const challenge = {
  id: 1,
  status: 'active',
  wgf_program_id: 'wgf_2step_phase1',
  initial_balance: 100_000,
  profit_target_percent: 8,
};

const fiveBalancedDays = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map(
  (d) => ({
    status: 'closed',
    pnl: 1600,
    created_at: `${d}T14:00:00.000Z`,
  }),
);

assert.equal(countWgfTradingDays(fiveBalancedDays), 5);
assert.equal(evaluateMinTradingDays(challenge, fiveBalancedDays).met, true);

const consistency = evaluateConsistencyRule(challenge, fiveBalancedDays, 108_000);
assert.equal(consistency.totalProfit, 8000);
assert.equal(consistency.bestDayProfit, 1600);
assert.equal(consistency.bestDaySharePct, 20);
assert.equal(consistency.compliant, true);

const oneBigDay = [
  { status: 'closed', pnl: 5000, created_at: '2026-11-01T12:00:00.000Z' },
  ...['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map((d) => ({
    status: 'closed',
    pnl: 750,
    created_at: `${d}T12:00:00.000Z`,
  })),
];
const badConsistency = evaluateConsistencyRule(challenge, oneBigDay, 108_000);
assert.equal(badConsistency.compliant, false);
assert.ok(badConsistency.bestDaySharePct > 40);

const passOk = evaluateProfitTargetPass(challenge, 108_000, fiveBalancedDays);
assert.equal(passOk.pass, true);

const passNoDays = evaluateProfitTargetPass(challenge, 108_000, []);
assert.equal(passNoDays.pass, false);
assert.equal(passNoDays.profitReached, true);
assert.ok(passNoDays.blockers?.length);

const passBadConsistency = evaluateProfitTargetPass(challenge, 108_000, oneBigDay);
assert.equal(passBadConsistency.pass, false);
assert.equal(passBadConsistency.profitReached, true);

assert.equal(aggregateDailyPnlByGmt(fiveBalancedDays).get('2026-11-03'), 1600);

const status = computeWgfComplianceStatus(challenge, fiveBalancedDays, 108_000);
assert.equal(status.readyForPass, true);

console.log('wgfCompliance: OK');
