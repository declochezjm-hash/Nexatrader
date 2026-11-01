import { useState } from 'react';
import { Lightbulb, X } from 'lucide-react';
import { useTrading } from '../context/TradingContext.jsx';
import { TRADING_TIPS } from '../lib/tutorialContent.js';

const DISMISS_KEY = 'nexatrader_tip_banner_dismissed';

/** Conseil du jour rotatif dans le panneau PropGuard. */
export default function TipsBanner() {
  const { setTutorialOpen } = useTrading();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dayIndex = Math.floor(Date.now() / 86_400_000) % TRADING_TIPS.length;
  const tip = TRADING_TIPS[dayIndex];

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-200">
          <Lightbulb className="h-3.5 w-3.5" />
          Conseil
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded p-0.5 text-amber-200/60 hover:text-amber-100"
          aria-label="Masquer les conseils"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-xs font-medium text-slate-200">{tip.title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{tip.text}</p>
      <button
        type="button"
        onClick={() => setTutorialOpen(true)}
        className="mt-2 text-[11px] font-medium text-sky-400 hover:text-sky-300"
      >
        Ouvrir le tutoriel complet →
      </button>
    </div>
  );
}
