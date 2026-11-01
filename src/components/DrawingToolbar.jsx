import { Minus, MousePointer2, Square, TrendingUp } from 'lucide-react';
import { useTrading } from '../context/TradingContext.jsx';

const TOOLS = [
  { id: null, icon: MousePointer2, label: 'Sélection' },
  { id: 'trendline', icon: TrendingUp, label: 'Tendance' },
  { id: 'horizontal', icon: Minus, label: 'Horizontal' },
  { id: 'rectangle', icon: Square, label: 'Rectangle' },
];

export default function DrawingToolbar() {
  const { drawingTool, setDrawingTool, chartReady } = useTrading();

  return (
    <aside className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-slate-800 bg-slate-950/90 py-2">
      {TOOLS.map(({ id, icon: Icon, label }) => {
        const active = drawingTool === id;
        return (
          <button
            key={label}
            type="button"
            title={label}
            disabled={!chartReady && id !== null}
            onClick={() => setDrawingTool(id)}
            className={`rounded-md p-2 transition ${
              active
                ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40'
                : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30'
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </button>
        );
      })}
      <p className="mt-auto px-1 text-center text-[9px] leading-tight text-slate-600">
        {chartReady
          ? drawingTool
            ? 'Clic pour tracer'
            : 'Sélection : clic · glisser · Suppr'
          : 'Chargement…'}
      </p>
    </aside>
  );
}
