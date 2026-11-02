import assert from 'node:assert/strict';
import {
  evaluateDailyReset,
  getGmtDateKey,
  msUntilNextGmtMidnight,
} from '../src/lib/wgfDailyReset.js';

const baseChallenge = {
  id: 1,
  status: 'active',
  wgf_program_id: 'wgf_2step_phase1',
  starting_daily_balance: 100_000,
  last_daily_reset_gmt: '2026-11-01',
};

const nov2 = new Date('2026-11-02T12:00:00.000Z');
assert.equal(getGmtDateKey(nov2), '2026-11-02');

const sameDayChallenge = { ...baseChallenge, last_daily_reset_gmt: '2026-11-02' };
const sameDay = evaluateDailyReset(sameDayChallenge, 101_000, nov2);
assert.equal(sameDay.apply, false);

const newDay = evaluateDailyReset(baseChallenge, 101_500, nov2);
assert.equal(newDay.apply, true);
assert.equal(newDay.challenge.starting_daily_balance, 101_500);
assert.equal(newDay.challenge.last_daily_reset_gmt, '2026-11-02');

const oneStep = evaluateDailyReset(
  { ...baseChallenge, wgf_program_id: 'wgf_1step_eval', last_daily_reset_gmt: '2026-11-01' },
  100_000,
  nov2,
);
assert.equal(oneStep.apply, false);
assert.equal(oneStep.skipped, 'no_daily_limit');

assert.ok(msUntilNextGmtMidnight(new Date('2026-11-02T23:00:00.000Z')) <= 3600000 + 1000);

console.log('wgfDailyReset: OK');
