import { buildWgfPhaseReadiness } from './wgfPhaseReadiness.js';
import { getChallengeWgfProgram } from './wgfPrograms.js';
import { isOneDayPassEnabled } from './wgfOneDayPass.js';
import { formatAuditEventType } from './wgfAuditLog.js';

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsv(cells) {
  return cells.map(csvEscape).join(',');
}

/**
 * @param {Array<object>} trades
 */
export function buildWgfTradesCsv(trades) {
  const headers = [
    'id',
    'symbol',
    'type',
    'lot_size',
    'risk_percent',
    'pnl',
    'status',
    'created_at',
  ];
  const lines = (trades ?? []).map((t) =>
    rowToCsv(headers.map((h) => t[h] ?? '')),
  );
  return `${headers.join(',')}\n${lines.join('\n')}`;
}

/**
 * @param {Array<object>} auditRows
 */
export function buildWgfAuditCsv(auditRows) {
  const headers = ['id', 'event_type', 'event_label', 'title', 'detail', 'equity', 'created_at'];
  const lines = (auditRows ?? []).map((r) =>
    rowToCsv([
      r.id,
      r.event_type,
      formatAuditEventType(r.event_type),
      r.title,
      r.detail,
      r.equity,
      r.created_at,
    ]),
  );
  return `${headers.join(',')}\n${lines.join('\n')}`;
}

/**
 * Dossier de phase WGF (CSV multi-sections, import Excel / archivage).
 * @param {object} params
 * @param {object|null|undefined} params.challenge
 * @param {Array<object>} params.trades
 * @param {Array<object>} params.auditRows
 */
export function buildWgfPhaseDossierCsv({ challenge, trades, auditRows }) {
  if (!challenge?.id) {
    return 'section,key,value\nmeta,error,Aucun challenge actif\n';
  }

  const program = getChallengeWgfProgram(challenge);
  const equity = Number(challenge.current_equity ?? challenge.initial_balance ?? 0);
  const readiness = buildWgfPhaseReadiness(challenge, trades, equity);
  const generatedAt = new Date().toISOString();

  const metaRows = [
    ['generated_at', generatedAt],
    ['challenge_id', challenge.id],
    ['status', challenge.status],
    ['program_id', challenge.wgf_program_id],
    ['program_label', program.label],
    ['initial_balance', challenge.initial_balance],
    ['current_equity', equity],
    ['one_day_pass', isOneDayPassEnabled(challenge) ? '1' : '0'],
    ['readiness_score_percent', readiness.scorePercent],
    ['evaluation_ready', readiness.evaluationReady ? '1' : '0'],
  ];

  const lines = ['section,key,value'];
  for (const [key, value] of metaRows) {
    lines.push(rowToCsv(['meta', key, value]));
  }

  for (const item of readiness.items) {
    lines.push(rowToCsv(['readiness', item.id, `${item.label}: ${item.detail} (${item.status})`]));
  }

  lines.push('');
  lines.push('# trades');
  lines.push(buildWgfTradesCsv(trades));

  lines.push('');
  lines.push('# audit');
  lines.push(buildWgfAuditCsv(auditRows));

  return lines.join('\n');
}

/**
 * Rapport HTML imprimable (Fichier → Imprimer → PDF).
 * @param {object} params
 */
export function buildWgfPhaseDossierHtml({ challenge, trades, auditRows }) {
  const program = getChallengeWgfProgram(challenge);
  const equity = Number(challenge?.current_equity ?? challenge?.initial_balance ?? 0);
  const readiness = buildWgfPhaseReadiness(challenge, trades ?? [], equity);
  const title = `NexaTrader — Dossier WGF #${challenge?.id ?? '—'}`;

  const readinessRows = readiness.items
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.label)}</td><td>${escapeHtml(i.detail)}</td><td>${escapeHtml(i.status)}</td></tr>`,
    )
    .join('');

  const tradeRows = (trades ?? [])
    .slice(-200)
    .map(
      (t) =>
        `<tr><td>${t.id}</td><td>${escapeHtml(t.symbol)}</td><td>${escapeHtml(t.type)}</td><td>${t.lot_size ?? ''}</td><td>${t.pnl ?? ''}</td><td>${escapeHtml(t.status)}</td><td>${escapeHtml(t.created_at)}</td></tr>`,
    )
    .join('');

  const auditHtml = (auditRows ?? [])
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.created_at)}</td><td>${escapeHtml(formatAuditEventType(r.event_type))}</td><td>${escapeHtml(r.title)}</td><td>${escapeHtml(r.detail ?? '')}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
    h1 { font-size: 1.25rem; }
    h2 { font-size: 1rem; margin-top: 1.5rem; border-bottom: 1px solid #ccc; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; }
    .meta { font-size: 13px; line-height: 1.6; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">Généré le ${escapeHtml(new Date().toLocaleString('fr-FR'))}<br/>
  Programme : ${escapeHtml(program.label)} · Statut : ${escapeHtml(challenge?.status ?? '—')}<br/>
  Équité : ${equity.toLocaleString('fr-FR')} $ / ${Number(challenge?.initial_balance ?? 0).toLocaleString('fr-FR')} $<br/>
  One Day Pass : ${isOneDayPassEnabled(challenge) ? 'Oui' : 'Non'} · Score readiness : ${readiness.scorePercent} %</p>

  <h2>Synthèse de phase</h2>
  <table><thead><tr><th>Critère</th><th>Détail</th><th>Statut</th></tr></thead><tbody>${readinessRows || '<tr><td colspan="3">—</td></tr>'}</tbody></table>

  <h2>Trades (200 derniers)</h2>
  <table><thead><tr><th>#</th><th>Symbole</th><th>Type</th><th>Lot</th><th>PnL</th><th>Statut</th><th>Date</th></tr></thead><tbody>${tradeRows || '<tr><td colspan="7">Aucun trade</td></tr>'}</tbody></table>

  <h2>Audit WGF</h2>
  <table><thead><tr><th>Date</th><th>Événement</th><th>Titre</th><th>Détail</th></tr></thead><tbody>${auditHtml || '<tr><td colspan="4">Aucun événement</td></tr>'}</tbody></table>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {object|null|undefined} challenge
 */
export function suggestWgfDossierBasename(challenge, ext = 'csv') {
  const d = new Date().toISOString().slice(0, 10);
  return `nexatrader-wgf-challenge-${challenge?.id ?? '0'}-${d}.${ext}`;
}
