import {
  DEFAULT_WGF_PROGRAM_ID,
  programHasDailyLossLimit,
} from './wgfPrograms.js';

/** @returns {string} YYYY-MM-DD (UTC / GMT) */
export function getGmtDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** Millisecondes jusqu’au prochain 00:00:00 GMT. */
export function msUntilNextGmtMidnight(now = new Date()) {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(0, next - now.getTime());
}

export function formatGmtCountdown(ms) {
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  return `${h} h ${m} min`;
}

/**
 * @param {object|null|undefined} challenge
 */
export function challengeUsesDailyGmtReset(challenge) {
  const programId = challenge?.wgf_program_id ?? DEFAULT_WGF_PROGRAM_ID;
  return programHasDailyLossLimit(programId);
}

/**
 * Détermine si un reset journalier WGF (00:00 GMT) doit être appliqué.
 * @param {object|null|undefined} challenge
 * @param {number} equity
 * @param {Date} [now]
 */
export function evaluateDailyReset(challenge, equity, now = new Date()) {
  if (!challenge?.id) {
    return { apply: false, challenge, todayKey: getGmtDateKey(now) };
  }

  if (!challengeUsesDailyGmtReset(challenge)) {
    return { apply: false, challenge, todayKey: getGmtDateKey(now), skipped: 'no_daily_limit' };
  }

  if (!['active', 'paused'].includes(String(challenge.status))) {
    return { apply: false, challenge, todayKey: getGmtDateKey(now), skipped: 'inactive' };
  }

  const todayKey = getGmtDateKey(now);
  const lastKey = challenge.last_daily_reset_gmt
    ? String(challenge.last_daily_reset_gmt).slice(0, 10)
    : null;

  if (lastKey === todayKey) {
    return { apply: false, challenge, todayKey, lastKey };
  }

  const nextChallenge = {
    ...challenge,
    starting_daily_balance: equity,
    last_daily_reset_gmt: todayKey,
    current_equity: equity,
  };

  return {
    apply: true,
    challenge: nextChallenge,
    todayKey,
    lastKey,
    message:
      lastKey == null
        ? 'Initialisation base journalière GMT.'
        : `Reset journalier GMT (${lastKey} → ${todayKey}).`,
  };
}
