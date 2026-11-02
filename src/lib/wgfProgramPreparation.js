import { WGF_PROGRAM_LIST, limitsForProgram } from './wgfPrograms.js';
import { buildWgfPhaseReadiness } from './wgfPhaseReadiness.js';
import { computeEquityFromTrades } from '../engine/propGuard.js';

/**
 * Score de préparation WGF (/100) pour chaque programme (simulation sur le même historique).
 * @param {object|null|undefined} challenge
 * @param {Array<object>} trades
 * @param {number} [equity]
 */
export function computeWgfPreparationByProgram(challenge, trades = [], equity) {
  if (!challenge?.id) return [];

  const eq =
    equity ??
    challenge.current_equity ??
    computeEquityFromTrades(challenge, trades);

  return WGF_PROGRAM_LIST.map((program) => {
    const limits = limitsForProgram(program.id);
    const synthetic = {
      ...challenge,
      status: 'active',
      wgf_program_id: program.id,
      wgf_phase: program.phase ?? challenge.wgf_phase,
      profit_target_percent: limits.profit_target_percent,
      max_daily_loss_percent: limits.max_daily_loss_percent,
      max_overall_loss_percent: limits.max_overall_loss_percent,
      one_day_pass: program.id === 'wgf_1step_eval' ? challenge.one_day_pass : 0,
    };
    const readiness = buildWgfPhaseReadiness(synthetic, trades, eq);
    return {
      programId: program.id,
      shortLabel: program.shortLabel,
      kind: program.kind,
      scorePercent: readiness.scorePercent,
      evaluationReady: readiness.evaluationReady,
      isCurrent: program.id === challenge.wgf_program_id,
    };
  });
}
