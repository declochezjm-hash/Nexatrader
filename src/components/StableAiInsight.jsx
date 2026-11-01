import { memo, useRef } from 'react';
import { BookOpen } from 'lucide-react';
import { geminiProviderLabel } from '../lib/geminiModels.js';
import { useThrottledInsight } from '../hooks/useDebouncedValue.js';

function scoreTone(confidence) {
  if (confidence >= 75) return { bar: 'bg-emerald-400', text: 'text-emerald-300', ring: 'ring-emerald-500/30' };
  if (confidence >= 50) return { bar: 'bg-amber-400', text: 'text-amber-300', ring: 'ring-amber-500/30' };
  return { bar: 'bg-rose-500', text: 'text-rose-300', ring: 'ring-rose-500/30' };
}

function StableAiInsight({ insight, aiProvider, frozen }) {
  const frozenRef = useRef(null);
  if (frozen && !frozenRef.current) {
    frozenRef.current = insight;
  }
  if (!frozen) {
    frozenRef.current = null;
  }

  const base = frozen ? frozenRef.current ?? insight : insight;
  const live = useThrottledInsight(base, frozen ? 86_400_000 : 4500);
  const shown = frozen ? base : live;
  const confidence = shown.confidence ?? 0;
  const tone = scoreTone(confidence);
  const signalStyles = {
    BUY: 'bg-emerald-500/20 text-emerald-300',
    SELL: 'bg-rose-500/20 text-rose-300',
    SKIP: 'bg-slate-700/80 text-slate-300',
  };

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/60 p-3 ring-1 ${tone.ring}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            {geminiProviderLabel(aiProvider)}
            {shown.source === 'sqlite' && (
              <span className="ml-1 text-slate-600">· fallback SQLite</span>
            )}
            {frozen && (
              <span className="ml-1 text-sky-500/80">
                <BookOpen className="mr-0.5 inline h-3 w-3" />
                figé
              </span>
            )}
          </p>
          <p className={`text-2xl font-semibold tabular-nums ${tone.text}`}>{confidence} %</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${signalStyles[shown.signal] ?? signalStyles.SKIP}`}
        >
          {shown.signal}
        </span>
      </div>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-700 ${tone.bar}`}
          style={{ width: `${Math.min(100, confidence)}%` }}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-slate-400">{shown.advice ?? 'Analyse en cours…'}</p>
    </div>
  );
}

export default memo(StableAiInsight);
