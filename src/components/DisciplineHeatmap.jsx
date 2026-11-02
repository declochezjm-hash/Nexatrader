import { memo, useMemo } from 'react';
import { buildDisciplineHeatmap } from '../lib/disciplineHeatmap.js';

export default memo(function DisciplineHeatmap({ trades }) {
  const { grid, dayLabels } = useMemo(() => buildDisciplineHeatmap(trades), [trades]);

  const hours = [0, 6, 12, 18];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        Heatmap discipline (GMT · tranches 6 h)
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="text-[9px] text-slate-400">
          <thead>
            <tr>
              <th className="pr-2 text-left" />
              {hours.map((h) => (
                <th key={h} className="px-1 tabular-nums">
                  {h}h
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dayLabels.map((label, day) => (
              <tr key={label}>
                <td className="pr-2 text-slate-500">{label}</td>
                {hours.map((baseHour) => {
                  const cell = grid.find((c) => c.day === day && c.hour === baseHour);
                  const bg =
                    !cell || cell.count === 0
                      ? 'bg-slate-900'
                      : cell.intensity > 0.65
                        ? 'bg-emerald-600/70'
                        : cell.intensity > 0.35
                          ? 'bg-amber-600/50'
                          : 'bg-rose-700/40';
                  return (
                    <td key={baseHour} className="p-0.5">
                      <span
                        title={`${cell?.count ?? 0} trades · PnL ${cell?.pnl ?? 0}`}
                        className={`block h-4 w-8 rounded ${bg}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
