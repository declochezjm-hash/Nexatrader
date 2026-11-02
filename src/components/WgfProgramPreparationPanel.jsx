import { memo, useMemo } from 'react';
import { computeWgfPreparationByProgram } from '../lib/wgfProgramPreparation.js';

export default memo(function WgfProgramPreparationPanel({ challenge, trades }) {
  const rows = useMemo(
    () => computeWgfPreparationByProgram(challenge, trades),
    [challenge, trades],
  );

  if (!challenge?.id || !rows.length) return null;

  return (
    <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-sky-300">
        Préparation WGF par programme (/100)
      </p>
      <ul className="mt-2 max-h-36 space-y-1 overflow-auto">
        {rows.map((r) => (
          <li
            key={r.programId}
            className={`flex items-center justify-between text-[10px] ${
              r.isCurrent ? 'text-emerald-200' : 'text-slate-400'
            }`}
          >
            <span>{r.shortLabel}</span>
            <span className="tabular-nums">
              {r.scorePercent} % {r.evaluationReady ? '· prêt' : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});
