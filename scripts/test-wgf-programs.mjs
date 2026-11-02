import assert from 'node:assert/strict';
import {
  DEFAULT_WGF_PROGRAM_ID,
  getWgfProgram,
  limitsForProgram,
  programHasDailyLossLimit,
  resolveDailyLossLimitPercent,
} from '../src/lib/wgfPrograms.js';

const twoStep = limitsForProgram('wgf_2step_phase1');
assert.equal(twoStep.profit_target_percent, 8);
assert.equal(twoStep.max_daily_loss_percent, 5);
assert.equal(twoStep.max_overall_loss_percent, 10);

const oneStep = limitsForProgram('wgf_1step_eval');
assert.equal(oneStep.profit_target_percent, 6);
assert.equal(oneStep.max_overall_loss_percent, 4);
assert.equal(programHasDailyLossLimit('wgf_1step_eval'), false);

assert.equal(resolveDailyLossLimitPercent({ wgf_program_id: 'wgf_1step_eval' }), null);
assert.equal(
  resolveDailyLossLimitPercent({ wgf_program_id: 'wgf_2step_phase1', max_daily_loss_percent: 5 }),
  5,
);

assert.equal(getWgfProgram('unknown').id, DEFAULT_WGF_PROGRAM_ID);

console.log('wgfPrograms: OK');
