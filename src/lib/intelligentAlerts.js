import { collectWgfProactiveAlerts } from './wgfPhaseReadiness.js';
import { getUpcomingHighImpactEvents } from '../engine/newsFilter.js';

/**
 * Alertes intelligentes : PropGuard + WGF + calendrier économique à venir.
 * @param {object} params
 */
export function collectIntelligentAlerts({ challenge, trades, propGuard, withinMinutes = 45 }) {
  /** @type {Array<{ id: string, level: string, title: string, message: string }>} */
  const alerts = [];

  for (const wgf of collectWgfProactiveAlerts({ challenge, trades, propGuard })) {
    alerts.push(wgf);
  }

  const upcoming = getUpcomingHighImpactEvents(new Date(), withinMinutes);
  for (const ev of upcoming.slice(0, 2)) {
    alerts.push({
      id: `news:${ev.code}:${ev.timeUtc?.toISOString?.() ?? ev.label}`,
      level: 'warn',
      title: `Annonce ${ev.code} proche`,
      message: `${ev.label} — fenêtre PropGuard conservateur ±15 min.`,
    });
  }

  return alerts;
}
