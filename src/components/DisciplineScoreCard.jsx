import { memo } from 'react';
import { Award } from 'lucide-react';

function DisciplineScoreCard({ discipline }) {
  if (!discipline) return null;

  let ring = 'ring-slate-500/20';
  let text = 'text-slate-300';
  if (discipline.score >= 85) {
    ring = 'ring-emerald-500/30';
    text = 'text-emerald-300';
  } else if (discipline.score >= 70) {
    ring = 'ring-sky-500/30';
    text = 'text-sky-300';
  } else if (discipline.score >= 55) {
    ring = 'ring-amber-500/30';
    text = 'text-amber-300';
  } else {
    ring = 'ring-rose-500/30';
    text = 'text-rose-300';
  }

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/60 p-3 ring-1 ${ring}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Award className={`h-4 w-4 ${text}`} />
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Score discipline WGF</span>
        </div>
        <span className={`text-xl font-bold tabular-nums ${text}`}>
          {discipline.score}
          <span className="ml-1 text-sm font-medium text-slate-500">/ 100 · {discipline.grade}</span>
        </span>
      </div>
      <ul className="space-y-1 text-[10px] leading-snug text-slate-400">
        {discipline.tips.map((t) => (
          <li key={t}>• {t}</li>
        ))}
      </ul>
    </div>
  );
}

export default memo(DisciplineScoreCard);
