/**
 * Profils officiels We Get Funded (réf. FAQ / blog WGF, 2026).
 * Étape 1 : définition + limites numériques (EOD, objectif profit, consistency = modules dédiés).
 */

export const DEFAULT_WGF_PROGRAM_ID = 'wgf_2step_phase1';

/** @typedef {'evaluation' | 'funded' | 'instant'} WgfProgramKind */

/**
 * @typedef {Object} WgfProgram
 * @property {string} id
 * @property {string} label
 * @property {string} shortLabel
 * @property {WgfProgramKind} kind
 * @property {number} [phase]
 * @property {number} profitTargetPercent
 * @property {number} maxDailyLossPercent
 * @property {number} maxOverallLossPercent
 * @property {'daily_static' | 'eod_trailing' | 'static_only'} drawdownMode
 * @property {number|null} consistencyPercent
 * @property {number|null} minTradingDays
 * @property {string} legalSummary
 * @property {string[]} rulesBullets
 * @property {string} sourceUrl
 */

/** @type {Record<string, WgfProgram>} */
export const WGF_PROGRAMS = {
  wgf_1step_eval: {
    id: 'wgf_1step_eval',
    label: 'WGF — 1 Step (évaluation)',
    shortLabel: '1 Step',
    kind: 'evaluation',
    phase: 1,
    profitTargetPercent: 6,
    maxDailyLossPercent: 0,
    maxOverallLossPercent: 4,
    drawdownMode: 'eod_trailing',
    consistencyPercent: 50,
    minTradingDays: 2,
    legalSummary:
      'Évaluation en une phase : objectif 6 %, perte max 4 % calculée en fin de journée (EOD) avec trailing jusqu’à couverture du buffer, puis plafond fixe. Pas de limite journalière séparée type 5 %.',
    rulesBullets: [
      'Objectif de profit : 6 %',
      'Perte max : 4 % (EOD trailing → fixe à la balance initiale)',
      'Jours de trading minimum : 2 (1 avec option One Day Pass chez WGF)',
      'Règle de consistency : 50 % (désactivée avec One Day Pass)',
      'News, overnight, weekend, scalping : autorisés chez WGF',
      'Levier indicatif WGF : 1:100',
    ],
    sourceUrl: 'https://wegetfunded.com/en/blog/one-step-prop-firm/',
  },
  wgf_2step_phase1: {
    id: 'wgf_2step_phase1',
    label: 'WGF — 2 Step (Phase 1)',
    shortLabel: '2 Step · P1',
    kind: 'evaluation',
    phase: 1,
    profitTargetPercent: 8,
    maxDailyLossPercent: 5,
    maxOverallLossPercent: 10,
    drawdownMode: 'daily_static',
    consistencyPercent: 40,
    minTradingDays: 5,
    legalSummary:
      'Première phase du 2 Step : objectif 8 %, perte journalière max 5 % (reset 00:00 GMT), drawdown total max 10 % vs balance initiale.',
    rulesBullets: [
      'Objectif de profit : 8 %',
      'Perte journalière max : 5 % (reset quotidien 00:00 GMT)',
      'Drawdown max : 10 %',
      'Jours de trading minimum : 5',
      'Consistency : 40 %',
      'News, overnight, weekend : autorisés',
    ],
    sourceUrl: 'https://wegetfunded.com/en/faq',
  },
  wgf_2step_phase2: {
    id: 'wgf_2step_phase2',
    label: 'WGF — 2 Step (Phase 2)',
    shortLabel: '2 Step · P2',
    kind: 'evaluation',
    phase: 2,
    profitTargetPercent: 5,
    maxDailyLossPercent: 5,
    maxOverallLossPercent: 10,
    drawdownMode: 'daily_static',
    consistencyPercent: 40,
    minTradingDays: 5,
    legalSummary:
      'Deuxième phase : objectif 5 %, mêmes plafonds de perte journalière (5 %) et drawdown (10 %) que la phase 1.',
    rulesBullets: [
      'Objectif de profit : 5 %',
      'Perte journalière max : 5 %',
      'Drawdown max : 10 %',
      'Jours minimum : 5 · Consistency : 40 %',
    ],
    sourceUrl: 'https://wegetfunded.com/en/faq',
  },
  wgf_funded: {
    id: 'wgf_funded',
    label: 'WGF — Compte funded (simulation)',
    shortLabel: 'Funded',
    kind: 'funded',
    phase: 0,
    profitTargetPercent: 0,
    maxDailyLossPercent: 5,
    maxOverallLossPercent: 10,
    drawdownMode: 'daily_static',
    consistencyPercent: 30,
    minTradingDays: 5,
    legalSummary:
      'Compte WGF après validation : pas d’objectif de profit imposé, perte jour 5 %, drawdown 10 %, consistency 30 %, minimum 5 jours actifs.',
    rulesBullets: [
      'Pas d’objectif de profit imposé',
      'Perte journalière max : 5 %',
      'Drawdown max : 10 % (seuil lié à la balance initiale après retrait chez WGF)',
      'Consistency : 30 % · 5 jours actifs minimum',
      'Split simulé WGF : 80 % (jusqu’à 100 % avec option)',
    ],
    sourceUrl: 'https://wegetfunded.com/en/faq',
  },
  wgf_instant: {
    id: 'wgf_instant',
    label: 'WGF — Instant Funding (simulation)',
    shortLabel: 'Instant',
    kind: 'instant',
    phase: 0,
    profitTargetPercent: 0,
    maxDailyLossPercent: 3,
    maxOverallLossPercent: 5,
    drawdownMode: 'daily_static',
    consistencyPercent: null,
    minTradingDays: null,
    legalSummary:
      'Produit instant funding WGF : plafonds plus serrés — perte journalière 3 %, drawdown max 5 %.',
    rulesBullets: [
      'Perte journalière max : 3 %',
      'Drawdown max : 5 %',
      'Consulter WGF pour les règles exactes du produit instant choisi',
    ],
    sourceUrl: 'https://wegetfunded.com/en',
  },
};

export const WGF_PROGRAM_LIST = Object.values(WGF_PROGRAMS);

/**
 * @param {string|null|undefined} id
 * @returns {WgfProgram}
 */
export function getWgfProgram(id) {
  if (id && WGF_PROGRAMS[id]) return WGF_PROGRAMS[id];
  return WGF_PROGRAMS[DEFAULT_WGF_PROGRAM_ID];
}

/**
 * Limites numériques pour SQLite / PropGuard (étape 1).
 * @param {string} programId
 */
export function limitsForProgram(programId) {
  const p = getWgfProgram(programId);
  return {
    profit_target_percent: p.profitTargetPercent,
    max_daily_loss_percent: p.maxDailyLossPercent,
    max_overall_loss_percent: p.maxOverallLossPercent,
  };
}

/**
 * @param {object|null|undefined} challenge
 */
export function getChallengeWgfProgram(challenge) {
  return getWgfProgram(challenge?.wgf_program_id);
}

export function programHasDailyLossLimit(programId) {
  const p = getWgfProgram(programId);
  return p.drawdownMode !== 'eod_trailing' && p.maxDailyLossPercent > 0;
}

/**
 * @param {object|null|undefined} challenge
 */
export function resolveDailyLossLimitPercent(challenge) {
  if (!challenge) return 5;
  const program = getChallengeWgfProgram(challenge);
  if (!programHasDailyLossLimit(program.id)) return null;
  const pct = challenge.max_daily_loss_percent ?? program.maxDailyLossPercent;
  return pct > 0 ? pct : null;
}

/**
 * @param {object|null|undefined} challenge
 */
export function resolveOverallLossLimitPercent(challenge) {
  if (!challenge) return 10;
  const program = getChallengeWgfProgram(challenge);
  return challenge.max_overall_loss_percent ?? program.maxOverallLossPercent ?? 10;
}
