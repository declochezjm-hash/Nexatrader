import { memo, useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import { buildPropGuardReplayTimeline } from '../lib/propGuardReplay.js';

export default memo(function PropGuardReplayPanel({ challenge, trades }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const timeline = useMemo(
    () => buildPropGuardReplayTimeline(challenge, trades),
    [challenge, trades],
  );

  if (!challenge?.id || !timeline.frames.length) return null;

  const frame = timeline.frames[Math.min(frameIndex, timeline.frames.length - 1)];

  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2">
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase text-amber-200">
        <Shield className="h-3 w-3" />
        PropGuard Replay
      </p>
      <p className="mt-1 text-[10px] text-slate-500">
        Rejoue l’équité et les drawdowns après chaque trade clôturé.
      </p>
      <input
        type="range"
        min={0}
        max={Math.max(0, timeline.frames.length - 1)}
        value={frameIndex}
        onChange={(e) => setFrameIndex(Number(e.target.value))}
        className="mt-2 w-full"
      />
      <p className="text-[11px] font-medium text-slate-200">{frame.label}</p>
      <p className="text-[10px] tabular-nums text-slate-400">
        Équité {Number(frame.equity).toLocaleString('fr-FR')} $ · DD jour{' '}
        {frame.drawdowns?.dailyDrawdownPct ?? 0} % · total{' '}
        {frame.drawdowns?.overallDrawdownPct ?? 0} %
      </p>
      {frame.fail?.fail ? (
        <p className="text-[10px] text-rose-300">Failed simulé : {frame.fail.reason}</p>
      ) : null}
    </div>
  );
});
