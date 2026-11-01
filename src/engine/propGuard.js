import { isNearNews } from './newsFilter.js';
import { isUsCashSession } from './nasdaqAnalyzer.js';

export const SPREAD_LIMITS = {
  XAUUSD: 0.4,
  NAS100: 2.5,
};

export const ANTI_TILT_MINUTES = 45;
export const ANTI_TILT_LOSS_THRESHOLD = 2;

export function computeDrawdowns(challenge) {
  if (!challenge) {
    return { dailyDrawdownPct: 0, overallDrawdownPct: 0 };
  }

  const dailyStart = challenge.starting_daily_balance || challenge.initial_balance || 1;
  const initial = challenge.initial_balance || 1;
  const equity = challenge.current_equity ?? initial;

  const dailyDrawdownPct = Math.max(0, ((dailyStart - equity) / dailyStart) * 100);
  const overallDrawdownPct = Math.max(0, ((initial - equity) / initial) * 100);

  return {
    dailyDrawdownPct: Number(dailyDrawdownPct.toFixed(2)),
    overallDrawdownPct: Number(overallDrawdownPct.toFixed(2)),
  };
}

export function isAntiTiltActive(challenge, nowMs = Date.now()) {
  if (!challenge?.anti_tilt_until) return false;
  return new Date(challenge.anti_tilt_until).getTime() > nowMs;
}

export function antiTiltRemainingMinutes(challenge, nowMs = Date.now()) {
  if (!challenge?.anti_tilt_until) return 0;
  const until = new Date(challenge.anti_tilt_until).getTime();
  if (until <= nowMs) return 0;
  return Math.ceil((until - nowMs) / 60000);
}

/**
 * @param {{
 *   symbol: string,
 *   currentSpread: number,
 *   challenge: object | null,
 *   inSession?: boolean,
 *   killSwitchActive?: boolean,
 *   paperTrading?: boolean,
 *   now?: Date,
 * }} ctx
 */
export function canOpenTrade({
  symbol,
  currentSpread,
  challenge,
  inSession = true,
  killSwitchActive = false,
  paperTrading = false,
  now = new Date(),
}) {
  const reasons = [];
  const badges = [];
  const spreadLimit = SPREAD_LIMITS[symbol] ?? SPREAD_LIMITS.XAUUSD;
  const { dailyDrawdownPct, overallDrawdownPct } = computeDrawdowns(challenge);
  const maxDaily = challenge?.max_daily_loss_percent ?? 5;
  const maxOverall = challenge?.max_overall_loss_percent ?? 10;
  const nowMs = now.getTime();

  if (killSwitchActive) {
    reasons.push('Kill Switch actif');
    badges.push({ id: 'kill', label: 'Kill Switch', tone: 'rose' });
  }

  if (!challenge || challenge.status === 'inactive') {
    reasons.push('Aucun challenge actif');
  }

  if (challenge?.status === 'paused') {
    if (paperTrading && !killSwitchActive) {
      badges.push({ id: 'paused', label: 'Challenge repris (paper)', tone: 'amber' });
    } else {
      reasons.push('Challenge en pause sécurisée');
    }
  }

  if (challenge?.status === 'failed') {
    reasons.push('Challenge FAILED — limite de perte atteinte');
    badges.push({ id: 'failed', label: 'Challenge FAILED', tone: 'rose' });
  }

  if (currentSpread > spreadLimit) {
    if (paperTrading) {
      badges.push({ id: 'spread', label: 'Spread élevé (paper OK)', tone: 'amber' });
    } else {
      reasons.push(`Spread trop élevé (${currentSpread.toFixed(2)} / max ${spreadLimit})`);
      badges.push({ id: 'spread', label: 'Spread trop fort', tone: 'amber' });
    }
  }

  if (symbol === 'NAS100' && !inSession) {
    if (paperTrading) {
      badges.push({ id: 'session', label: 'Hors session (paper OK)', tone: 'amber' });
    } else {
      reasons.push('NAS100 hors session US (cash)');
      badges.push({ id: 'session', label: 'Hors session US', tone: 'amber' });
    }
  }

  if (isAntiTiltActive(challenge, nowMs)) {
    const mins = antiTiltRemainingMinutes(challenge, nowMs);
    reasons.push(`Pause anti-tilt (${mins} min restantes)`);
    badges.push({ id: 'anti-tilt', label: 'Pause Anti-Tilt', tone: 'amber' });
  }

  const news = isNearNews(symbol, 15, now);
  if (news.near) {
    if (paperTrading) {
      badges.push({ id: 'news', label: 'Annonce proche (paper OK)', tone: 'amber' });
    } else {
      reasons.push(`Annonce imminente : ${news.event.label}`);
      badges.push({ id: 'news', label: 'Annonce économique', tone: 'rose' });
    }
  }

  if (dailyDrawdownPct >= maxDaily) {
    reasons.push(`Drawdown journalier WGF (${dailyDrawdownPct}% ≥ ${maxDaily}%)`);
  }

  if (overallDrawdownPct >= maxOverall) {
    reasons.push(`Drawdown global WGF (${overallDrawdownPct}% ≥ ${maxOverall}%)`);
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    badges,
    dailyDrawdownPct,
    overallDrawdownPct,
    maxDaily,
    maxOverall,
    spreadLimit,
    currentSpread,
    news,
    blocked: reasons.length > 0,
  };
}

/** Alias UI legacy (Étape 2). */
export function evaluatePropGuard(ctx) {
  const gate = canOpenTrade({
    symbol: ctx.symbol ?? 'XAUUSD',
    currentSpread:
      ctx.currentSpread ??
      (ctx.spreadPoints != null ? ctx.spreadPoints / 100 : 0),
    challenge: ctx.challenge,
    inSession: ctx.inSession ?? true,
    killSwitchActive: ctx.antiTiltPaused && ctx.killSwitchActive,
    now: ctx.now,
  });

  if (ctx.antiTiltPaused && !gate.badges.some((b) => b.id === 'anti-tilt')) {
    gate.reasons.push('Pause anti-tilt active');
    gate.badges.push({ id: 'anti-tilt', label: 'Pause Anti-Tilt', tone: 'amber' });
    gate.allowed = false;
    gate.blocked = true;
  }

  return gate;
}

/**
 * Recalcule l'équité à partir des trades clôturés.
 * @param {object} challenge
 * @param {Array<{ pnl: number, status: string }>} trades
 */
export function computeEquityFromTrades(challenge, trades) {
  const base = challenge?.initial_balance ?? 0;
  const realized = trades
    .filter((t) => ['closed', 'emergency_closed'].includes(t.status))
    .reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  return Number((base + realized).toFixed(2));
}

/**
 * Détermine si le challenge doit passer en FAILED.
 */
export function shouldFailChallenge(challenge, equity) {
  if (!challenge) return { fail: false };
  const initial = challenge.initial_balance || 1;
  const dailyStart = challenge.starting_daily_balance || initial;
  const dailyDd = Math.max(0, ((dailyStart - equity) / dailyStart) * 100);
  const overallDd = Math.max(0, ((initial - equity) / initial) * 100);
  const maxDaily = challenge.max_daily_loss_percent ?? 5;
  const maxOverall = challenge.max_overall_loss_percent ?? 10;

  if (overallDd >= maxOverall) {
    return { fail: true, reason: `Drawdown global ${overallDd.toFixed(2)}% (max ${maxOverall}%)` };
  }
  if (dailyDd >= maxDaily) {
    return { fail: true, reason: `Drawdown journalier ${dailyDd.toFixed(2)}% (max ${maxDaily}%)` };
  }
  return { fail: false };
}

export function nextAntiTiltUntil(fromDate = new Date()) {
  return new Date(fromDate.getTime() + ANTI_TILT_MINUTES * 60 * 1000).toISOString();
}

export function resolveSession(symbol, unixSeconds = Math.floor(Date.now() / 1000)) {
  if (symbol === 'NAS100') {
    return isUsCashSession(unixSeconds);
  }
  return true;
}
