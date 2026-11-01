import { memo } from 'react';
import { FastForward, Pause, Play, Rewind, Square } from 'lucide-react';

function SessionReplayBar({
  replayActive,
  replayFrame,
  replayTotal,
  onStart,
  onStop,
  onStep,
}) {
  if (!replayActive && replayTotal < 10) {
    return (
      <button
        type="button"
        onClick={onStart}
        disabled={replayTotal < 10}
        className="text-[10px] text-violet-400 hover:text-violet-300 disabled:text-slate-600"
        title="Besoin d’au moins ~10 bougies visibles"
      >
        ▶ Replay session (historique figé)
      </button>
    );
  }

  if (!replayActive) {
    return (
      <button
        type="button"
        onClick={onStart}
        className="inline-flex items-center gap-1 rounded border border-violet-500/40 px-2 py-0.5 text-[10px] text-violet-200 hover:bg-violet-500/10"
      >
        <Play className="h-3 w-3" />
        Replay ({replayTotal} bougies)
      </button>
    );
  }

  const pct = replayTotal > 0 ? Math.round((replayFrame / replayTotal) * 100) : 0;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-500/35 bg-violet-950/30 px-2 py-1.5">
      <span className="text-[10px] font-medium text-violet-200">
        Replay · {replayFrame}/{replayTotal} ({pct}%)
      </span>
      <button type="button" onClick={() => onStep(-10)} className="rounded p-1 text-violet-300 hover:bg-violet-500/20" title="-10 bougies">
        <Rewind className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => onStep(-1)} className="rounded p-1 text-violet-300 hover:bg-violet-500/20" title="-1">
        <Pause className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => onStep(1)} className="rounded p-1 text-violet-300 hover:bg-violet-500/20" title="+1">
        <FastForward className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => onStep(10)} className="rounded px-1 text-[10px] text-violet-300 hover:bg-violet-500/20">
        +10
      </button>
      <button type="button" onClick={onStop} className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-800" title="Quitter replay">
        <Square className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default memo(SessionReplayBar);
