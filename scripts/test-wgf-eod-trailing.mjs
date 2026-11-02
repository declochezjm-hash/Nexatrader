import assert from 'node:assert/strict';
import {
  applyEodTrailingStep,
  challengeUsesEodTrailing,
  computeInitialEodFloor,
  evaluateEodIntradayFail,
  evaluateEodMidnightRollover,
} from '../src/lib/wgfEodTrailing.js';
import { shouldFailChallenge } from '../src/engine/propGuard.js';

const oneStep = {
  id: 1,
  status: 'active',
  wgf_program_id: 'wgf_1step_eval',
  initial_balance: 100_000,
  max_overall_loss_percent: 4,
  eod_trailing_floor: 96_000,
  last_eod_process_gmt: '2026-11-01',
  last_equity_snapshot: 100_000,
  current_equity: 100_000,
};

assert.equal(challengeUsesEodTrailing(oneStep), true);
assert.equal(computeInitialEodFloor(oneStep), 96_000);

assert.equal(evaluateEodIntradayFail(oneStep, 96_001).fail, false);
assert.equal(evaluateEodIntradayFail(oneStep, 95_999).fail, true);

const fail = shouldFailChallenge(oneStep, 95_500);
assert.equal(fail.fail, true);

const nov2 = new Date('2026-11-02T01:00:00.000Z');
const profitDay = {
  ...oneStep,
  last_equity_snapshot: 102_000,
  current_equity: 102_000,
};
const rollover = evaluateEodMidnightRollover(profitDay, 102_000, nov2);
assert.equal(rollover.apply, true);
assert.equal(rollover.newFloor, 98_000);
assert.equal(applyEodTrailingStep(96_000, 100_000, oneStep), 96_000);

const locked = applyEodTrailingStep(99_000, 104_000, oneStep);
assert.equal(locked, 100_000);

console.log('wgfEodTrailing: OK');
