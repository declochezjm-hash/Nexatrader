import { useEffect, useRef, useState } from 'react';

export function useDebouncedValue(value, delayMs = 800) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Valeur numérique stable à l’écran : commit au plus toutes les minIntervalMs,
 * ou plus tôt si le marché bouge de jumpThreshold (ex. or).
 */
export function useStableNumeric(value, options = {}) {
  const { minIntervalMs = 3000, jumpThreshold = 0.2 } = options;
  const [stable, setStable] = useState(value);
  const lastRef = useRef({ t: 0, v: value });

  useEffect(() => {
    if (value == null || !Number.isFinite(value)) {
      setStable(value);
      lastRef.current = { t: Date.now(), v: value };
      return undefined;
    }

    const now = Date.now();
    const prev = lastRef.current.v;
    const prevNum = Number.isFinite(prev) ? prev : value;
    const jump = Math.abs(value - prevNum) >= jumpThreshold;
    const stale = now - lastRef.current.t >= minIntervalMs;

    if (jump || stale) {
      lastRef.current = { t: now, v: value };
      setStable(value);
      return undefined;
    }

    const wait = Math.max(0, minIntervalMs - (now - lastRef.current.t));
    const t = setTimeout(() => {
      lastRef.current = { t: Date.now(), v: value };
      setStable(value);
    }, wait);
    return () => clearTimeout(t);
  }, [value, minIntervalMs, jumpThreshold]);

  return stable;
}

export function useThrottledInsight(insight, minIntervalMs = 2000) {
  const [stable, setStable] = useState(insight);
  const lastRef = useRef({ t: 0, sig: '', conf: 0 });

  useEffect(() => {
    const sig = insight?.signal ?? 'SKIP';
    const conf = insight?.confidence ?? 0;
    const now = Date.now();
    const delta = Math.abs(conf - lastRef.current.conf);
    const signalChanged = sig !== lastRef.current.sig;
    const bigMove = delta >= 4;
    const stale = now - lastRef.current.t >= minIntervalMs;

    if (signalChanged || bigMove || stale) {
      lastRef.current = { t: now, sig, conf };
      setStable(insight);
    }
  }, [insight, minIntervalMs]);

  return stable;
}
