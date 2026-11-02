import assert from 'node:assert/strict';
import {
  buildWgfAuditCsv,
  buildWgfPhaseDossierCsv,
  buildWgfPhaseDossierHtml,
  buildWgfTradesCsv,
  suggestWgfDossierBasename,
} from '../src/lib/wgfPhaseExport.js';

const challenge = {
  id: 42,
  status: 'active',
  wgf_program_id: 'wgf_2step_phase1',
  initial_balance: 100_000,
  current_equity: 104_000,
  one_day_pass: 0,
  profit_target_percent: 8,
};

const trades = [
  {
    id: 1,
    symbol: 'XAUUSD',
    type: 'BUY',
    lot_size: 0.5,
    pnl: 120,
    status: 'closed',
    created_at: '2026-11-01T10:00:00.000Z',
  },
];

const audit = [
  {
    id: 1,
    event_type: 'challenge_new',
    title: 'Test',
    detail: 'hello',
    equity: 100_000,
    created_at: '2026-11-01T09:00:00.000Z',
  },
];

const tradesCsv = buildWgfTradesCsv(trades);
assert.ok(tradesCsv.includes('XAUUSD'));

const auditCsv = buildWgfAuditCsv(audit);
assert.ok(auditCsv.includes('Nouveau challenge'));

const dossier = buildWgfPhaseDossierCsv({ challenge, trades, auditRows: audit });
assert.ok(dossier.includes('section,key,value'));
assert.ok(dossier.includes('readiness'));
assert.ok(dossier.includes('# trades'));

const html = buildWgfPhaseDossierHtml({ challenge, trades, auditRows: audit });
assert.ok(html.includes('<!DOCTYPE html>'));
assert.ok(html.includes('Dossier WGF'));

assert.ok(suggestWgfDossierBasename(challenge, 'csv').endsWith('.csv'));

console.log('wgfPhaseExport: OK');
