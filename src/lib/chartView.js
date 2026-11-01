/** Nombre de bougies visibles par défaut (lisible, stable). */
export const DEFAULT_VISIBLE_BARS = 96;

/** Vue étendue : plus de contexte temporel à l’écran. */
export const EXTENDED_VISIBLE_BARS = 220;

export const EXTENDED_BAR_SPACING = 5;

export const CLOSE_UP_VISIBLE_BARS = 24;

export const DEFAULT_BAR_SPACING = 10;

export const MIN_BAR_SPACING = 0.5;

export const MAX_BAR_SPACING = 120;

export const CLOSE_UP_BAR_SPACING = 22;

export function getChartInteractionOptions() {
  return {
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: {
      axisPressedMouseMove: { time: true, price: true },
      axisDoubleClickReset: { time: true, price: true },
      mouseWheel: true,
      pinch: true,
    },
    kineticScroll: {
      mouse: true,
      touch: true,
    },
  };
}

export function getTimeScaleOptions(timeframe, { followLive = false } = {}) {
  return {
    borderColor: '#334155',
    timeVisible: true,
    secondsVisible: timeframe === '1m',
    barSpacing: DEFAULT_BAR_SPACING,
    minBarSpacing: MIN_BAR_SPACING,
    rightOffset: 14,
    fixLeftEdge: false,
    fixRightEdge: false,
    lockVisibleTimeRangeOnResize: true,
    rightBarStaysOnScroll: true,
    shiftVisibleRangeOnNewBar: followLive,
    allowShiftVisibleRangeOnWhitespaceReplacement: followLive,
  };
}

/**
 * Vue initiale : dernières N bougies, sans écraser le zoom utilisateur ensuite.
 */
export function applyDefaultVisibleRange(chart, totalBars, visibleBars = DEFAULT_VISIBLE_BARS) {
  if (!chart || totalBars <= 0) return;
  const from = Math.max(0, totalBars - visibleBars);
  const to = totalBars + 10;
  chart.timeScale().setVisibleLogicalRange({ from, to });
}

export function adjustZoom(chart, barSpacingRef, direction) {
  if (!chart || !barSpacingRef) return;
  const factor = direction === 'in' ? 1.18 : 1 / 1.18;
  let next = (barSpacingRef.current ?? DEFAULT_BAR_SPACING) * factor;
  next = Math.min(MAX_BAR_SPACING, Math.max(MIN_BAR_SPACING, next));
  barSpacingRef.current = next;
  chart.timeScale().applyOptions({ barSpacing: next, minBarSpacing: MIN_BAR_SPACING });
}

/** Gros plan sur les dernières bougies (analyse « marché »). */
export function applyCloseUpZoom(chart, totalBars, barSpacingRef) {
  if (!chart || totalBars <= 0) return;
  barSpacingRef.current = CLOSE_UP_BAR_SPACING;
  chart.timeScale().applyOptions({
    barSpacing: CLOSE_UP_BAR_SPACING,
    minBarSpacing: MIN_BAR_SPACING,
  });
  applyDefaultVisibleRange(chart, totalBars, CLOSE_UP_VISIBLE_BARS);
}

/** Affiche un maximum de bougies (analyse / simulation sur l’historique). */
export function applyExtendedVisibleRange(chart, totalBars, barSpacingRef) {
  if (!chart || totalBars <= 0) return;
  const visible = Math.min(totalBars, EXTENDED_VISIBLE_BARS);
  barSpacingRef.current = EXTENDED_BAR_SPACING;
  chart.timeScale().applyOptions({
    barSpacing: EXTENDED_BAR_SPACING,
    minBarSpacing: MIN_BAR_SPACING,
  });
  applyDefaultVisibleRange(chart, totalBars, visible);
}

export function setFollowLive(chart, follow, barSpacingRef) {
  chart?.timeScale().applyOptions({
    shiftVisibleRangeOnNewBar: follow,
    allowShiftVisibleRangeOnWhitespaceReplacement: follow,
    rightOffset: follow ? 8 : 14,
  });
  if (follow) {
    chart?.timeScale().scrollToRealTime();
  }
}
