import { getChallengeWgfProgram } from './wgfPrograms.js';

export const ONE_DAY_PASS_PROGRAM_ID = 'wgf_1step_eval';

/**
 * @param {object|null|undefined} challenge
 */
export function isOneDayPassEligible(challenge) {
  const id = challenge?.wgf_program_id ?? getChallengeWgfProgram(challenge).id;
  return id === ONE_DAY_PASS_PROGRAM_ID;
}

/**
 * @param {object|null|undefined} challenge
 */
export function isOneDayPassEnabled(challenge) {
  return isOneDayPassEligible(challenge) && Number(challenge?.one_day_pass) === 1;
}

/**
 * Jours minimum effectifs (1 avec One Day Pass actif sur 1 Step).
 * @param {object|null|undefined} challenge
 * @returns {number|null}
 */
export function getEffectiveMinTradingDays(challenge) {
  const program = getChallengeWgfProgram(challenge);
  if (program.minTradingDays == null) return null;
  if (isOneDayPassEnabled(challenge)) return 1;
  return program.minTradingDays;
}

/**
 * @param {object|null|undefined} challenge
 */
export function isConsistencyDisabledByOneDayPass(challenge) {
  return isOneDayPassEnabled(challenge);
}
