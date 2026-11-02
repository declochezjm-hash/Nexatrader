import {
  getChallengeWgfProgram,
  getWgfProgram,
  limitsForProgram,
} from './wgfPrograms.js';
import { computeWgfComplianceStatus } from './wgfCompliance.js';

/**
 * @param {object|null|undefined} challenge
 */
export function resolveProfitTargetPercent(challenge) {
  if (!challenge) return 0;
  const program = getChallengeWgfProgram(challenge);
  if (program.kind !== 'evaluation') return 0;
  const pct = Number(challenge.profit_target_percent ?? program.profitTargetPercent ?? 0);
  return pct > 0 ? pct : 0;
}

/**
 * @param {object|null|undefined} challenge
 * @param {number} [equity]
 */
export function computeProfitProgress(challenge, equity) {
  const initial = Number(challenge?.initial_balance ?? 0);
  const eq = Number(equity ?? challenge?.current_equity ?? initial);
  const targetPct = resolveProfitTargetPercent(challenge);
  const profitPct = initial > 0 ? ((eq - initial) / initial) * 100 : 0;

  return {
    profitPct: Number(profitPct.toFixed(2)),
    targetPct,
    targetEquity: Number((initial * (1 + targetPct / 100)).toFixed(2)),
    remainingPct: Number(Math.max(0, targetPct - profitPct).toFixed(2)),
    reached: targetPct > 0 && profitPct >= targetPct - 0.001,
  };
}

/**
 * Prochain profil WGF après validation d'une phase d'évaluation.
 * @param {object|null|undefined} challenge
 * @returns {string|null}
 */
export function getNextWgfProgramId(challenge) {
  const id = challenge?.wgf_program_id ?? getChallengeWgfProgram(challenge).id;
  if (id === 'wgf_2step_phase1') return 'wgf_2step_phase2';
  if (id === 'wgf_2step_phase2') return 'wgf_funded';
  if (id === 'wgf_1step_eval') return 'wgf_funded';
  return null;
}

/**
 * @param {object|null|undefined} challenge
 * @returns {{ label: string, programId: string } | null}
 */
export function describeNextWgfPhase(challenge) {
  const nextId = getNextWgfProgramId(challenge);
  if (!nextId) return null;
  const program = getWgfProgram(nextId);
  return { label: program.shortLabel, programId: nextId };
}

/**
 * Validation de phase WGF : objectif % + jours min. + consistency (étapes 4–5).
 * @param {object|null|undefined} challenge
 * @param {number} equity
 * @param {Array<object>} [trades]
 */
export function evaluateProfitTargetPass(challenge, equity, trades = []) {
  if (!challenge?.id) return { pass: false };
  if (challenge.status === 'passed') {
    return { pass: false, alreadyPassed: true };
  }
  if (!['active', 'paused'].includes(String(challenge.status))) {
    return { pass: false, skipped: challenge.status };
  }

  const targetPct = resolveProfitTargetPercent(challenge);
  if (targetPct <= 0) {
    return { pass: false, noTarget: true };
  }

  const progress = computeProfitProgress(challenge, equity);
  if (!progress.reached) {
    return { pass: false, progress };
  }

  const compliance = computeWgfComplianceStatus(challenge, trades, equity);
  if (!compliance.readyForPass) {
    return {
      pass: false,
      profitReached: true,
      progress,
      compliance,
      blockers: compliance.blockingReasons,
      message: `Objectif ${targetPct} % atteint — en attente : ${compliance.blockingReasons.join(' · ')}`,
    };
  }

  const program = getChallengeWgfProgram(challenge);
  const next = describeNextWgfPhase(challenge);
  const message = next
    ? `Phase validée (${progress.profitPct} % / ${targetPct} %) — prochaine étape : ${next.label}.`
    : `Objectif ${targetPct} % validé (${progress.profitPct} %).`;

  return {
    pass: true,
    message,
    progress,
    programLabel: program.shortLabel,
    nextPhase: next,
    limits: limitsForProgram(challenge.wgf_program_id),
    compliance,
  };
}
