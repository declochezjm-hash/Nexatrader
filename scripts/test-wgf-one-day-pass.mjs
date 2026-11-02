import assert from 'node:assert/strict';
import {
  computeWgfComplianceStatus,
  evaluateMinTradingDays,
  evaluateConsistencyRule,
} from '../src/lib/wgfCompliance.js';
import { evaluateProfitTargetPass } from '../src/lib/wgfProfitTarget.js';
import {
  isOneDayPassEligible,
  isOneDayPassEnabled,
  getEffectiveMinTradingDays,
} from '../src/lib/wgfOneDayPass.js';

const base1Step = {
  id: 1,
  status: 'active',
  wgf_program_id: 'wgf_1step_eval',
  initial_balance: 100_000,
  profit_target_percent: 6,
  one_day_pass: 0,
};

const odpChallenge = { ...base1Step, one_day_pass: 1 };

assert.equal(isOneDayPassEligible(base1Step), true);
assert.equal(isOneDayPassEnabled(odpChallenge), true);
assert.equal(getEffectiveMinTradingDays(base1Step), 2);
assert.equal(getEffectiveMinTradingDays(odpChallenge), 1);

const oneDayTrade = [
  { status: 'closed', pnl: 7000, created_at: '2026-11-01T14:00:00.000Z' },
];

assert.equal(evaluateMinTradingDays(odpChallenge, oneDayTrade).met, true);
assert.equal(evaluateMinTradingDays(base1Step, oneDayTrade).met, false);

const badConsistency = evaluateConsistencyRule(odpChallenge, oneDayTrade, 107_000);
assert.equal(badConsistency.skipped, true);

const passOdp = evaluateProfitTargetPass(odpChallenge, 107_000, oneDayTrade);
assert.equal(passOdp.pass, true);

const status = computeWgfComplianceStatus(odpChallenge, oneDayTrade, 107_000);
assert.equal(status.readyForPass, true);

console.log('wgfOneDayPass: OK');
