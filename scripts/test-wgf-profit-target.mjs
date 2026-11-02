import assert from 'node:assert/strict';
import {
  computeProfitProgress,
  describeNextWgfPhase,
  evaluateProfitTargetPass,
  getNextWgfProgramId,
} from '../src/lib/wgfProfitTarget.js';

const twoStepP1 = {
  id: 1,
  status: 'active',
  wgf_program_id: 'wgf_2step_phase1',
  initial_balance: 100_000,
  profit_target_percent: 8,
  current_equity: 107_500,
};

const progress = computeProfitProgress(twoStepP1, 107_500);
assert.equal(progress.profitPct, 7.5);
assert.equal(progress.reached, false);

const passEquity = 108_000;
const compliantTrades = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map(
  (d) => ({
    status: 'closed',
    pnl: 1600,
    created_at: `${d}T12:00:00.000Z`,
  }),
);

const pass = evaluateProfitTargetPass(twoStepP1, passEquity, compliantTrades);
assert.equal(pass.pass, true);
assert.equal(pass.progress.profitPct, 8);

assert.equal(getNextWgfProgramId(twoStepP1), 'wgf_2step_phase2');
assert.equal(describeNextWgfPhase(twoStepP1)?.programId, 'wgf_2step_phase2');

const oneStep = { ...twoStepP1, wgf_program_id: 'wgf_1step_eval', profit_target_percent: 6 };
const oneStepTrades = ['2026-11-01', '2026-11-02'].map((d) => ({
  status: 'closed',
  pnl: 3000,
  created_at: `${d}T12:00:00.000Z`,
}));
assert.equal(evaluateProfitTargetPass(oneStep, 106_000, oneStepTrades).pass, true);
assert.equal(getNextWgfProgramId(oneStep), 'wgf_funded');

const funded = { ...twoStepP1, wgf_program_id: 'wgf_funded', profit_target_percent: 0 };
assert.equal(evaluateProfitTargetPass(funded, 120_000, compliantTrades).pass, false);
assert.equal(evaluateProfitTargetPass(funded, 120_000, compliantTrades).noTarget, true);

console.log('wgfProfitTarget: OK');
