import assert from 'node:assert/strict';
import { canOpenTrade } from '../src/engine/propGuard.js';
import {
  resolveWgfEnforcementMode,
  WGF_ENFORCEMENT_CONSERVATIVE,
  WGF_ENFORCEMENT_OFFICIAL,
} from '../src/lib/wgfEnforcement.js';

const challenge = {
  id: 1,
  status: 'active',
  initial_balance: 100_000,
  current_equity: 100_000,
  wgf_program_id: 'wgf_2step_phase1',
  starting_daily_balance: 100_000,
};

assert.equal(
  resolveWgfEnforcementMode({ wgf_enforcement_mode: WGF_ENFORCEMENT_OFFICIAL }),
  WGF_ENFORCEMENT_OFFICIAL,
);
assert.equal(resolveWgfEnforcementMode({ paper_trading: 0 }), WGF_ENFORCEMENT_CONSERVATIVE);
assert.equal(resolveWgfEnforcementMode({ paper_trading: 1 }), WGF_ENFORCEMENT_OFFICIAL);

const conservative = canOpenTrade({
  symbol: 'XAUUSD',
  currentSpread: 1.2,
  challenge,
  inSession: true,
  wgfEnforcementMode: WGF_ENFORCEMENT_CONSERVATIVE,
});
assert.equal(conservative.allowed, false);
assert.ok(conservative.reasons.some((r) => /spread/i.test(r)));

const official = canOpenTrade({
  symbol: 'XAUUSD',
  currentSpread: 1.2,
  challenge,
  inSession: true,
  wgfEnforcementMode: WGF_ENFORCEMENT_OFFICIAL,
});
assert.equal(official.allowed, true);
assert.ok(official.badges.some((b) => b.id === 'spread'));

const nasConservative = canOpenTrade({
  symbol: 'NAS100',
  currentSpread: 0.5,
  challenge,
  inSession: false,
  wgfEnforcementMode: WGF_ENFORCEMENT_CONSERVATIVE,
});
assert.equal(nasConservative.allowed, false);

const nasOfficial = canOpenTrade({
  symbol: 'NAS100',
  currentSpread: 0.5,
  challenge,
  inSession: false,
  wgfEnforcementMode: WGF_ENFORCEMENT_OFFICIAL,
});
assert.equal(nasOfficial.allowed, true);

console.log('wgfEnforcement: OK');
