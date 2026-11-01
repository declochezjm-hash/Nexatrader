import { LineChart } from 'lucide-react';
import { useTrading } from '../context/TradingContext.jsx';

export default function ChartPlaceholder() {
  const { symbol, timeframe } = useTrading();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-slate-900/40 p-8 text-center">
      <LineChart className="h-12 w-12 text-slate-600" strokeWidth={1.25} />
      <div>
        <p className="text-sm font-medium text-slate-300">
          Zone graphique — {symbol} · {timeframe}
        </p>
        <p className="mt-1 max-w-sm text-xs text-slate-500">
          Lightweight Charts sera intégré à l’étape suivante. Les données temps réel s’afficheront
          ici.
        </p>
      </div>
    </div>
  );
}
