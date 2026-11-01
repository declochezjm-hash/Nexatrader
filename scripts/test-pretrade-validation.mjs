import assert from 'node:assert/strict';
import {
  assessAiOrderConflict,
  validateStopLossForSide,
} from '../src/lib/preTradeValidation.js';

function test(name, fn) {
  try {
    fn();
    console.log(`OK ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`, err);
    process.exitCode = 1;
  }
}

test('BUY SL must be below entry', () => {
  const bad = validateStopLossForSide('BUY', 2655.45, 2659.7);
  assert.equal(bad.valid, false);
  assert.equal(bad.code, 'wrong_side');
  const good = validateStopLossForSide('BUY', 2655.45, 2649.59);
  assert.equal(good.valid, true);
});

test('SELL SL must be above entry', () => {
  const bad = validateStopLossForSide('SELL', 100, 99);
  assert.equal(bad.valid, false);
  const good = validateStopLossForSide('SELL', 100, 101);
  assert.equal(good.valid, true);
});

test('AI conflict when side opposes high-confidence signal', () => {
  const c = assessAiOrderConflict('BUY', { signal: 'SELL', confidence: 86 });
  assert.equal(c.conflict, true);
  const aligned = assessAiOrderConflict('BUY', { signal: 'BUY', confidence: 90 });
  assert.equal(aligned.conflict, false);
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log('All pre-trade validation tests passed.');
