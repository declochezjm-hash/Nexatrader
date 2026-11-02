import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutGrid,
  Maximize2,
  PanelBottom,
  PanelRight,
  Rows3,
} from 'lucide-react';

const STORAGE_KEY = 'nexatrader_layout_v2';

const PRESETS = {
  chart: { sidebarWidth: 280, journalHeight: 140, sidebarOpen: true, bottomOpen: true },
  balanced: { sidebarWidth: 320, journalHeight: 200, sidebarOpen: true, bottomOpen: true },
  journal: { sidebarWidth: 260, journalHeight: 320, sidebarOpen: true, bottomOpen: true },
  focus: { sidebarWidth: 300, journalHeight: 120, sidebarOpen: true, bottomOpen: false },
};

const DEFAULTS = PRESETS.balanced;

const LIMITS = {
  sidebarMin: 240,
  sidebarMax: 480,
  journalMin: 100,
  journalMaxRatio: 0.58,
  sidebarCollapsedWidth: 40,
  bottomCollapsedHeight: 36,
};

function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS, sidebarOpen: true, bottomOpen: true };
    const parsed = JSON.parse(raw);
    return {
      sidebarWidth: Number(parsed.sidebarWidth) || DEFAULTS.sidebarWidth,
      journalHeight: Number(parsed.journalHeight) || DEFAULTS.journalHeight,
      sidebarOpen: parsed.sidebarOpen !== false,
      bottomOpen: parsed.bottomOpen !== false,
    };
  } catch {
    return { ...DEFAULTS, sidebarOpen: true, bottomOpen: true };
  }
}

function persistLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* quota */
  }
}

function ResizeGutter({ orientation, onDragStart, onDoubleReset, label }) {
  const isVertical = orientation === 'vertical';
  return (
    <div
      role="separator"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      aria-label={label}
      title={`${label} · double-clic = réinitialiser`}
      onPointerDown={onDragStart}
      onDoubleClick={onDoubleReset}
      className={`group z-10 flex shrink-0 touch-none select-none items-center justify-center ${
        isVertical
          ? 'w-2 cursor-col-resize bg-slate-900/90 hover:bg-sky-500/20'
          : 'h-2 cursor-row-resize bg-slate-900/90 hover:bg-sky-500/20'
      }`}
    >
      <div
        className={`rounded-full bg-slate-600/90 group-hover:bg-sky-400/80 ${
          isVertical ? 'h-14 w-1' : 'h-1 w-14'
        }`}
      />
    </div>
  );
}

function LayoutPresetButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition ${
        active
          ? 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/35'
          : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'
      }`}
    >
      <Icon className="h-3 w-3" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/**
 * Workspace redimensionnable : graphique | PropGuard + journal / analytics.
 */
export default function ResizableWorkspace({ chart, sidebar, bottom }) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULTS.sidebarWidth);
  const [journalHeight, setJournalHeight] = useState(DEFAULTS.journalHeight);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [preset, setPreset] = useState('balanced');
  const layoutRef = useRef({
    sidebarWidth: DEFAULTS.sidebarWidth,
    journalHeight: DEFAULTS.journalHeight,
    sidebarOpen: true,
    bottomOpen: true,
  });

  useEffect(() => {
    const saved = loadLayout();
    setSidebarWidth(saved.sidebarWidth);
    setJournalHeight(saved.journalHeight);
    setSidebarOpen(saved.sidebarOpen);
    setBottomOpen(saved.bottomOpen);
    layoutRef.current = saved;
  }, []);

  const commitLayout = useCallback(() => {
    persistLayout(layoutRef.current);
  }, []);

  const applyPreset = useCallback(
    (key) => {
      const p = PRESETS[key] ?? PRESETS.balanced;
      layoutRef.current = { ...layoutRef.current, ...p };
      setSidebarWidth(p.sidebarWidth);
      setJournalHeight(p.journalHeight);
      setSidebarOpen(p.sidebarOpen);
      setBottomOpen(p.bottomOpen);
      setPreset(key);
      commitLayout();
    },
    [commitLayout],
  );

  const startSidebarDrag = useCallback(
    (e) => {
      if (!sidebarOpen) return;
      e.preventDefault();
      const startX = e.clientX;
      const startW = layoutRef.current.sidebarWidth;
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        const next = Math.min(
          LIMITS.sidebarMax,
          Math.max(LIMITS.sidebarMin, startW + (ev.clientX - startX)),
        );
        layoutRef.current.sidebarWidth = next;
        setSidebarWidth(next);
        setPreset('custom');
      };

      const onUp = () => {
        target.releasePointerCapture(e.pointerId);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        commitLayout();
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [commitLayout, sidebarOpen],
  );

  const startJournalDrag = useCallback(
    (e) => {
      if (!bottomOpen) return;
      e.preventDefault();
      const startY = e.clientY;
      const startH = layoutRef.current.journalHeight;
      const maxH = Math.floor(window.innerHeight * LIMITS.journalMaxRatio);
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        const next = Math.min(
          maxH,
          Math.max(LIMITS.journalMin, startH + (ev.clientY - startY)),
        );
        layoutRef.current.journalHeight = next;
        setJournalHeight(next);
        setPreset('custom');
      };

      const onUp = () => {
        target.releasePointerCapture(e.pointerId);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        commitLayout();
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [bottomOpen, commitLayout],
  );

  const toggleSidebar = useCallback(() => {
    layoutRef.current.sidebarOpen = !layoutRef.current.sidebarOpen;
    setSidebarOpen(layoutRef.current.sidebarOpen);
    commitLayout();
  }, [commitLayout]);

  const toggleBottom = useCallback(() => {
    layoutRef.current.bottomOpen = !layoutRef.current.bottomOpen;
    setBottomOpen(layoutRef.current.bottomOpen);
    commitLayout();
  }, [commitLayout]);

  const resetSidebar = useCallback(() => {
    applyPreset('balanced');
  }, [applyPreset]);

  const resetJournal = useCallback(() => {
    layoutRef.current.journalHeight = DEFAULTS.journalHeight;
    setJournalHeight(DEFAULTS.journalHeight);
    commitLayout();
  }, [commitLayout]);

  const effectiveSidebarWidth = sidebarOpen ? sidebarWidth : LIMITS.sidebarCollapsedWidth;
  const effectiveJournalHeight = bottomOpen ? journalHeight : LIMITS.bottomCollapsedHeight;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-950">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-900/40 px-2 py-1">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[9px] font-medium uppercase tracking-wider text-slate-600">
            Disposition
          </span>
          <LayoutPresetButton
            active={preset === 'chart'}
            onClick={() => applyPreset('chart')}
            icon={Maximize2}
            label="Graphique"
          />
          <LayoutPresetButton
            active={preset === 'balanced'}
            onClick={() => applyPreset('balanced')}
            icon={LayoutGrid}
            label="Équilibré"
          />
          <LayoutPresetButton
            active={preset === 'journal'}
            onClick={() => applyPreset('journal')}
            icon={Rows3}
            label="Journal"
          />
          <LayoutPresetButton
            active={preset === 'focus'}
            onClick={() => applyPreset('focus')}
            icon={PanelRight}
            label="Focus"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleSidebar}
            className={`rounded-lg p-1.5 ${
              sidebarOpen ? 'text-sky-300 bg-sky-500/10' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="PropGuard (panneau droit)"
          >
            <PanelRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleBottom}
            className={`rounded-lg p-1.5 ${
              bottomOpen ? 'text-sky-300 bg-sky-500/10' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Journal / Analytics (bas)"
          >
            <PanelBottom className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {chart}
        </div>

        {sidebarOpen ? (
          <>
            <ResizeGutter
              orientation="vertical"
              onDragStart={startSidebarDrag}
              onDoubleReset={resetSidebar}
              label="PropGuard"
            />
            <div
              className="flex min-h-0 shrink-0 flex-col overflow-hidden border-l border-slate-800/60 bg-slate-950/90 shadow-[-8px_0_24px_rgba(0,0,0,0.25)]"
              style={{ width: effectiveSidebarWidth }}
            >
              {sidebar}
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex w-10 shrink-0 flex-col items-center justify-center gap-1 border-l border-slate-800 bg-slate-900/80 text-[9px] text-slate-500 hover:bg-slate-800 hover:text-sky-300"
            title="Ouvrir PropGuard"
          >
            <PanelRight className="h-4 w-4" />
            <span className="[writing-mode:vertical-rl] rotate-180">PropGuard</span>
          </button>
        )}
      </div>

      {bottomOpen ? (
        <>
          <ResizeGutter
            orientation="horizontal"
            onDragStart={startJournalDrag}
            onDoubleReset={resetJournal}
            label="Journal"
          />
          <div
            className="flex min-h-0 shrink-0 flex-col overflow-hidden border-t border-slate-800/60 bg-slate-950/95"
            style={{ height: effectiveJournalHeight }}
          >
            {bottom}
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={toggleBottom}
          className="flex h-9 shrink-0 items-center justify-center gap-2 border-t border-slate-800 bg-slate-900/80 text-[10px] text-slate-500 hover:bg-slate-800 hover:text-sky-300"
        >
          <PanelBottom className="h-3.5 w-3.5" />
          Afficher journal / analytics
        </button>
      )}
    </div>
  );
}
