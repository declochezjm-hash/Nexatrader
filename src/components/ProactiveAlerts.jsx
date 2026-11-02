import { memo, useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTradingSession } from '../context/TradingContext.jsx';
import { collectIntelligentAlerts } from '../lib/intelligentAlerts.js';

const DISMISS_MS = 12000;

function AlertToast({ alert, onDismiss }) {
  const tone =
    alert.level === 'critical'
      ? 'border-rose-500/50 bg-rose-950/90 text-rose-100'
      : 'border-amber-500/45 bg-amber-950/90 text-amber-100';

  return (
    <div
      className={`pointer-events-auto flex max-w-sm gap-2 rounded-xl border px-3 py-2.5 text-xs shadow-lg ${tone}`}
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{alert.title}</p>
        <p className="mt-0.5 leading-relaxed opacity-90">{alert.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(alert.id)}
        className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
        aria-label="Fermer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ProactiveAlertsInner() {
  const { propGuard, proactiveAlertsEnabled, challenge, trades } = useTradingSession();
  const [visible, setVisible] = useState([]);
  const seenRef = useRef(new Set());

  useEffect(() => {
    if (!proactiveAlertsEnabled) return;

    const next = [];
    const dailyRatio =
      propGuard.maxDaily > 0 ? propGuard.dailyDrawdownPct / propGuard.maxDaily : 0;
    const overallRatio =
      propGuard.maxOverall > 0 ? propGuard.overallDrawdownPct / propGuard.maxOverall : 0;

    if (propGuard.blocked && propGuard.reasons?.length) {
      const key = `block:${propGuard.reasons.join('|')}`;
      if (!seenRef.current.has(key)) {
        seenRef.current.add(key);
        next.push({
          id: key,
          level: 'warn',
          title: 'PropGuard — exécution bloquée',
          message: propGuard.reasons.slice(0, 3).join(' · '),
        });
      }
    }

    if (dailyRatio >= 0.8 && dailyRatio < 1) {
      const key = `daily:${Math.floor(dailyRatio * 100)}`;
      if (!seenRef.current.has(key)) {
        seenRef.current.add(key);
        next.push({
          id: key,
          level: 'warn',
          title: 'Drawdown journalier élevé',
          message: `${propGuard.dailyDrawdownPct.toFixed(1)} % sur ${propGuard.maxDaily} % max — réduisez le risque ou arrêtez-vous.`,
        });
      }
    }

    if (overallRatio >= 0.8 && overallRatio < 1) {
      const key = `overall:${Math.floor(overallRatio * 100)}`;
      if (!seenRef.current.has(key)) {
        seenRef.current.add(key);
        next.push({
          id: key,
          level: 'critical',
          title: 'Drawdown total proche de la limite WGF',
          message: `${propGuard.overallDrawdownPct.toFixed(1)} % / ${propGuard.maxOverall} % — priorité préservation du capital.`,
        });
      }
    }

    for (const wgf of collectIntelligentAlerts({ challenge, trades, propGuard })) {
      if (seenRef.current.has(wgf.id)) continue;
      seenRef.current.add(wgf.id);
      next.push(wgf);
    }

    if (next.length) {
      setVisible((prev) => [...prev, ...next].slice(-4));
    }
  }, [propGuard, proactiveAlertsEnabled, challenge, trades]);

  useEffect(() => {
    if (!visible.length) return undefined;
    const t = setTimeout(() => {
      setVisible((prev) => prev.slice(1));
    }, DISMISS_MS);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible.length) return null;

  return (
    <div className="pointer-events-none fixed left-4 top-14 z-50 flex flex-col gap-2">
      {visible.map((a) => (
        <AlertToast key={a.id} alert={a} onDismiss={(id) => setVisible((p) => p.filter((x) => x.id !== id))} />
      ))}
    </div>
  );
}

export default memo(ProactiveAlertsInner);
