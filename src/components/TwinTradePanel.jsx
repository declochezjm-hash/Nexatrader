import { memo } from 'react';
import { GitCompare } from 'lucide-react';
import { buildTwinTradeComparison } from '../lib/twinTrade.js';

function TwinTradePanel({ trade, inlinePlan }) {
  const twin = buildTwinTradeComparison(trade, inlinePlan);

  if (!twin.available) {
    return (
      <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-2 py-1.5 text-[10px] text-slate-500">
        Twin trade : {twin.reason}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-2.5 py-2">
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-sky-300">
        <GitCompare className="h-3 w-3" />
        Twin trade · alignement {twin.alignmentScore} %
      </p>
      <p className="mt-1 text-[10px] text-slate-400">{twin.summary}</p>
      <ul className="mt-2 space-y-1">
        {twin.rows.map((row) => (
          <li
            key={row.id}
            className={`flex justify-between text-[10px] ${row.ok ? 'text-emerald-300' : 'text-amber-200'}`}
          >
            <span>{row.label}</span>
            <span className="text-slate-400">{row.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default memo(TwinTradePanel);
