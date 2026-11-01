import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'nexatrader_layout_v1';

const DEFAULTS = {
  sidebarWidth: 320,
  journalHeight: 208,
};

const LIMITS = {
  sidebarMin: 260,
  sidebarMax: 520,
  journalMin: 120,
  journalMaxRatio: 0.55,
};

function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      sidebarWidth: Number(parsed.sidebarWidth) || DEFAULTS.sidebarWidth,
      journalHeight: Number(parsed.journalHeight) || DEFAULTS.journalHeight,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function persistLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* quota */
  }
}

function ResizeGutter({ orientation, onDragStart, onDoubleReset }) {
  const isVertical = orientation === 'vertical';
  return (
    <div
      role="separator"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      title={isVertical ? 'Glisser pour redimensionner le panneau PropGuard' : 'Glisser pour redimensionner le journal'}
      onPointerDown={onDragStart}
      onDoubleClick={onDoubleReset}
      className={`group z-10 shrink-0 touch-none select-none ${
        isVertical
          ? 'w-1.5 cursor-col-resize hover:w-2'
          : 'h-1.5 cursor-row-resize hover:h-2'
      } bg-slate-800/80 transition-[width,height] hover:bg-sky-500/40 active:bg-sky-500/60`}
    >
      <div
        className={`mx-auto rounded-full bg-slate-600/80 group-hover:bg-sky-400/70 ${
          isVertical ? 'my-auto h-10 w-0.5' : 'mt-auto h-0.5 w-10'
        }`}
      />
    </div>
  );
}

/**
 * Zone centrale redimensionnable : graphique | PropGuard + journal / analytics.
 */
export default function ResizableWorkspace({ chart, sidebar, bottom }) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULTS.sidebarWidth);
  const [journalHeight, setJournalHeight] = useState(DEFAULTS.journalHeight);
  const layoutRef = useRef({ sidebarWidth: DEFAULTS.sidebarWidth, journalHeight: DEFAULTS.journalHeight });

  useEffect(() => {
    const saved = loadLayout();
    setSidebarWidth(saved.sidebarWidth);
    setJournalHeight(saved.journalHeight);
    layoutRef.current = saved;
  }, []);

  const commitLayout = useCallback(() => {
    persistLayout(layoutRef.current);
  }, []);

  const startSidebarDrag = useCallback(
    (e) => {
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
    [commitLayout],
  );

  const startJournalDrag = useCallback(
    (e) => {
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
    [commitLayout],
  );

  const resetSidebar = useCallback(() => {
    layoutRef.current.sidebarWidth = DEFAULTS.sidebarWidth;
    setSidebarWidth(DEFAULTS.sidebarWidth);
    commitLayout();
  }, [commitLayout]);

  const resetJournal = useCallback(() => {
    layoutRef.current.journalHeight = DEFAULTS.journalHeight;
    setJournalHeight(DEFAULTS.journalHeight);
    commitLayout();
  }, [commitLayout]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{chart}</div>
        <ResizeGutter
          orientation="vertical"
          onDragStart={startSidebarDrag}
          onDoubleReset={resetSidebar}
        />
        <div
          className="flex min-h-0 shrink-0 flex-col overflow-hidden border-l border-slate-800/50"
          style={{ width: sidebarWidth }}
        >
          {sidebar}
        </div>
      </div>
      <ResizeGutter
        orientation="horizontal"
        onDragStart={startJournalDrag}
        onDoubleReset={resetJournal}
      />
      <div
        className="flex min-h-0 shrink-0 flex-col overflow-hidden border-t border-slate-800/50"
        style={{ height: journalHeight }}
      >
        {bottom}
      </div>
    </div>
  );
}
