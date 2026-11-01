import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';
import { useTradingMarket, useTradingSession } from '../context/TradingContext.jsx';
import {
  computeDynamicSpread,
  createTwelveDataFeed,
  generateHistoricalCandles,
} from '../engine/twelveDataFeed.js';
import { parseCandleFile, downloadSampleCsv } from '../lib/candleImport.js';
import { fetchLiveCandlesFromMain, resolveMarketFeedLabel } from '../lib/marketDataClient.js';
import {
  isDemoMarketProvider,
  isLiveMarketProvider,
  normalizeMarketProvider,
} from '../lib/marketFeedMode.js';
import { createChartBridge } from '../lib/chartBridge.js';
import { deleteChartDrawing, fetchChartDrawings } from '../lib/chartDrawings.js';
import { applyDrawingDrag, HANDLE_RADIUS, hitTestDrawings } from '../lib/drawingEdit.js';
import {
  adjustZoom,
  applyCloseUpZoom,
  applyDefaultVisibleRange,
  applyExtendedVisibleRange,
  getChartInteractionOptions,
  getTimeScaleOptions,
  setFollowLive as applyChartFollowLive,
  DEFAULT_BAR_SPACING,
} from '../lib/chartView.js';
import { isUsCashSession } from '../engine/nasdaqAnalyzer.js';
import {
  findCandleIndexForTrade,
  visibleRangeAroundIndex,
} from '../lib/tradeChartFocus.js';
import TradeReviewBanner from './TradeReviewBanner.jsx';

/** Bougies générées / affichées par défaut (plus d’historique visible). */
const SIM_HISTORICAL_COUNT = 480;
/** Regroupe les mises à jour React du flux simulé (~20 Hz max, 60 FPS chart). */
const TICK_UI_FLUSH_MS = 50;

function buildMarkers(assetSignals) {
  return assetSignals
    .filter((s) => s.marker === 'hammer' || s.marker === 'shooting_star')
    .slice(-12)
    .map((s) => {
      const isHammer = s.marker === 'hammer';
      return {
        time: s.time,
        position: isHammer ? 'belowBar' : 'aboveBar',
        color: isHammer ? '#34d399' : '#fb7185',
        shape: isHammer ? 'arrowUp' : 'arrowDown',
        text: isHammer ? 'H' : 'SS',
      };
    });
}

export default memo(function ChartContainer() {
  const {
    symbol,
    timeframe,
    setChartBridge,
    setChartReady,
    drawingTool,
    drawings,
    setDrawings,
    setMarketPrice,
    setCurrentSpread,
    setActiveStopLoss,
    activeStopLoss,
    importedSeries,
    setImportedSeries,
    clearImportedSeries,
    registerChartControls,
  } = useTradingMarket();

  const {
    analyzeCandles,
    latestChartSignal,
    setLatestChartSignal,
    setInSession,
    settings,
    processMarketTick,
    replayActive,
    activeTradeReview,
    clearTradeChartReview,
  } = useTradingSession();

  const wrapRef = useRef(null);
  const chartHostRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const overlayRef = useRef(null);
  const bridgeRef = useRef(null);
  const candlesRef = useRef([]);
  const slLineRef = useRef(null);
  const beLineRef = useRef(null);
  const analyzeTimerRef = useRef(null);
  const tickRef = useRef(0);
  const pendingDrawRef = useRef(null);
  const barSpacingRef = useRef(DEFAULT_BAR_SPACING);
  const drawingsRef = useRef(drawings);
  drawingsRef.current = drawings;
  const selectedDrawingRef = useRef(null);
  const editDragRef = useRef(null);

  const [slPrice, setSlPrice] = useState(null);
  const [bePrice, setBePrice] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const [drawHint, setDrawHint] = useState('');
  const [followLive, setFollowLive] = useState(false);
  const [feedPaused, setFeedPaused] = useState(false);
  const [feedVersion, setFeedVersion] = useState(0);
  const [feedHint, setFeedHint] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [selectedDrawingId, setSelectedDrawingId] = useState(null);
  selectedDrawingRef.current = selectedDrawingId;
  const fileInputRef = useRef(null);
  const feedRuntimeRef = useRef({ mode: 'sim' });
  const pendingTickUiRef = useRef({
    marketPrice: null,
    spread: null,
    monitorCandle: null,
    analysisCandles: null,
  });
  const tickUiFlushTimerRef = useRef(null);
  const lastAssetSignalsRef = useRef([]);
  const tradeReviewPriceLinesRef = useRef([]);

  const redrawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;
    const wrap = chartHostRef.current;
    if (!canvas || !chart || !series || !wrap) return;

    const { width, height } = wrap.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const selectedId = selectedDrawingRef.current;

    for (const d of drawingsRef.current) {
      const isSelected = selectedId != null && d.id === selectedId;
      ctx.lineWidth = isSelected ? (d.lineWidth ?? 2) + 1 : (d.lineWidth ?? 2);
      ctx.setLineDash(d.type === 'horizontal' ? [6, 4] : []);

      if (d.type === 'horizontal' && d.coordinates.price != null) {
        const y = series.priceToCoordinate(d.coordinates.price);
        if (y == null) continue;
        ctx.strokeStyle = isSelected ? '#fde047' : (d.color ?? '#fbbf24');
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        if (isSelected) {
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(width * 0.5, y, HANDLE_RADIUS - 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (d.type === 'trendline' && d.coordinates.p1 && d.coordinates.p2) {
        const x1 = chart.timeScale().timeToCoordinate(d.coordinates.p1.time);
        const y1 = series.priceToCoordinate(d.coordinates.p1.price);
        const x2 = chart.timeScale().timeToCoordinate(d.coordinates.p2.time);
        const y2 = series.priceToCoordinate(d.coordinates.p2.price);
        if ([x1, y1, x2, y2].some((v) => v == null)) continue;
        ctx.strokeStyle = isSelected ? '#e9d5ff' : (d.color ?? '#c084fc');
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        if (isSelected) {
          ctx.fillStyle = '#e9d5ff';
          for (const [hx, hy] of [
            [x1, y1],
            [x2, y2],
          ]) {
            ctx.beginPath();
            ctx.arc(hx, hy, HANDLE_RADIUS - 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      if (d.type === 'rectangle' && d.coordinates.p1 && d.coordinates.p2) {
        const x1 = chart.timeScale().timeToCoordinate(d.coordinates.p1.time);
        const y1 = series.priceToCoordinate(d.coordinates.p1.price);
        const x2 = chart.timeScale().timeToCoordinate(d.coordinates.p2.time);
        const y2 = series.priceToCoordinate(d.coordinates.p2.price);
        if ([x1, y1, x2, y2].some((v) => v == null)) continue;
        ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.22)' : 'rgba(56, 189, 248, 0.12)';
        ctx.strokeStyle = isSelected ? '#7dd3fc' : '#38bdf8';
        ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        if (isSelected) {
          ctx.fillStyle = '#7dd3fc';
          for (const [hx, hy] of [
            [x1, y1],
            [x2, y2],
          ]) {
            ctx.beginPath();
            ctx.arc(hx, hy, HANDLE_RADIUS - 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    const pending = pendingDrawRef.current;
    if (pending?.p1) {
      const x1 = chart.timeScale().timeToCoordinate(pending.p1.time);
      const y1 = series.priceToCoordinate(pending.p1.price);
      if (x1 != null && y1 != null) {
        ctx.strokeStyle = pending.type === 'rectangle' ? '#38bdf8' : '#c084fc';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(x1, y1, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, []);

  const placeDrawingAt = useCallback(
    async (time, price) => {
      if (!drawingTool || time == null || price == null) return;

      const bridge = bridgeRef.current;
      const roundedPrice = Number(Number(price).toFixed(2));

      if (drawingTool === 'horizontal') {
        const coordinates = { price: roundedPrice };
        const id =
          (bridge ? await bridge.persistDrawing(symbol, { type: 'horizontal', coordinates }) : null) ??
          `local-${Date.now()}`;
        setDrawings((prev) => [
          ...prev,
          { id, type: 'horizontal', coordinates, color: '#fbbf24', lineWidth: 2 },
        ]);
        setDrawHint('');
        redrawOverlay();
        return;
      }

      if (drawingTool === 'trendline' || drawingTool === 'rectangle') {
        if (!pendingDrawRef.current) {
          pendingDrawRef.current = {
            type: drawingTool,
            p1: { time, price: roundedPrice },
          };
          setDrawHint('Cliquez le second point pour terminer le tracé.');
          redrawOverlay();
          return;
        }
        const coordinates = {
          p1: pendingDrawRef.current.p1,
          p2: { time, price: roundedPrice },
        };
        const id =
          (bridge
            ? await bridge.persistDrawing(symbol, { type: drawingTool, coordinates })
            : null) ?? `local-${Date.now()}`;
        setDrawings((prev) => [
          ...prev,
          {
            id,
            type: drawingTool,
            coordinates,
            color: drawingTool === 'rectangle' ? '#38bdf8' : '#c084fc',
            lineWidth: 2,
          },
        ]);
        pendingDrawRef.current = null;
        setDrawHint('');
        redrawOverlay();
      }
    },
    [drawingTool, redrawOverlay, setDrawings, symbol],
  );

  const hitTestPrice = useCallback((y, price) => {
    const series = seriesRef.current;
    if (!series || price == null) return false;
    const lineY = series.priceToCoordinate(price);
    return lineY != null && Math.abs(lineY - y) < 8;
  }, []);

  const removeGuideLines = useCallback(() => {
    const series = seriesRef.current;
    if (!series) return;
    for (const ref of [slLineRef, beLineRef]) {
      if (ref.current) {
        series.removePriceLine(ref.current);
        ref.current = null;
      }
    }
  }, []);

  const applyGuideLines = useCallback(
    (sl, be) => {
      const series = seriesRef.current;
      if (!series) return;
      removeGuideLines();
      if (sl != null) {
        slLineRef.current = series.createPriceLine({
          price: sl,
          color: '#f97316',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'SL (drag)',
        });
      }
      if (be != null) {
        beLineRef.current = series.createPriceLine({
          price: be,
          color: '#38bdf8',
          lineWidth: 2,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: 'BE 1.5R',
        });
      }
    },
    [removeGuideLines],
  );

  const runAnalysis = useCallback(
    (candles) => {
      if (!candles.length) return;
      clearTimeout(analyzeTimerRef.current);
      analyzeTimerRef.current = setTimeout(async () => {
        try {
          const windowCandles = candles.slice(-120);
          const result = await analyzeCandles(windowCandles, symbol);
          lastAssetSignalsRef.current = result.assetSignals ?? [];
          seriesRef.current?.setMarkers(buildMarkers(lastAssetSignalsRef.current));

          const sig = result.latestSignal;
          if (sig?.stopLoss != null) {
            setSlPrice(sig.stopLoss);
            setBePrice(sig.breakEven ?? null);
            applyGuideLines(sig.stopLoss, sig.breakEven ?? null);
          }

          if (symbol === 'NAS100') {
            const lastTime = candles[candles.length - 1]?.time;
            setInSession(isUsCashSession(lastTime ?? Math.floor(Date.now() / 1000)));
          }
        } catch {
          /* ignore */
        }
      }, 120);
    },
    [analyzeCandles, applyGuideLines, setInSession, symbol],
  );

  const flushTickUiState = useCallback(() => {
    tickUiFlushTimerRef.current = null;
    const pending = pendingTickUiRef.current;
    if (pending.marketPrice != null) {
      setMarketPrice(pending.marketPrice);
    }
    if (pending.spread != null) {
      setCurrentSpread(pending.spread);
    }
    if (pending.monitorCandle) {
      void processMarketTick(pending.monitorCandle);
    }
    if (pending.analysisCandles) {
      runAnalysis(pending.analysisCandles);
    }
    pendingTickUiRef.current = {
      marketPrice: null,
      spread: null,
      monitorCandle: null,
      analysisCandles: null,
    };
  }, [processMarketTick, runAnalysis, setCurrentSpread, setMarketPrice]);

  const scheduleTickUiFlush = useCallback(() => {
    if (tickUiFlushTimerRef.current != null) return;
    tickUiFlushTimerRef.current = setTimeout(flushTickUiState, TICK_UI_FLUSH_MS);
  }, [flushTickUiState]);

  const queueTickUiUpdates = useCallback(
    ({ marketPrice, spread, monitorCandle, analysisCandles }) => {
      const pending = pendingTickUiRef.current;
      if (marketPrice != null) pending.marketPrice = marketPrice;
      if (spread != null) pending.spread = spread;
      if (monitorCandle) pending.monitorCandle = monitorCandle;
      if (analysisCandles) pending.analysisCandles = analysisCandles;
      scheduleTickUiFlush();
    },
    [scheduleTickUiFlush],
  );

  useEffect(() => {
    if (!chartHostRef.current) return undefined;

    const chart = createChart(chartHostRef.current, {
      autoSize: true,
      layout: {
        background: { color: '#0b0f14' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#162032' },
        horzLines: { color: '#162032' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      ...getChartInteractionOptions(),
      timeScale: getTimeScaleOptions(timeframe, { followLive: false }),
      rightPriceScale: {
        borderColor: '#334155',
        scaleMargins: { top: 0.08, bottom: 0.12 },
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderUpColor: '#10b981',
      borderDownColor: '#f43f5e',
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    chartRef.current = chart;
    seriesRef.current = series;
    barSpacingRef.current = DEFAULT_BAR_SPACING;
    bridgeRef.current = createChartBridge(chart, series, chartHostRef.current);
    setChartBridge(bridgeRef.current);
    setChartReady(true);

    const onRange = () => redrawOverlay();
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);

    const resizeObs = new ResizeObserver(() => {
      redrawOverlay();
    });
    resizeObs.observe(chartHostRef.current);

    return () => {
      resizeObs.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      setChartReady(false);
      setChartBridge(null);
      bridgeRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [redrawOverlay, setChartBridge, setChartReady, timeframe]);

  useEffect(() => {
    chartRef.current?.timeScale().applyOptions({
      secondsVisible: timeframe === '1m',
    });
  }, [timeframe]);

  useEffect(() => {
    if (chartRef.current) {
      applyChartFollowLive(chartRef.current, followLive, barSpacingRef);
    }
  }, [followLive]);

  useEffect(() => {
    pendingDrawRef.current = null;
    setDrawHint('');
    if (drawingTool) {
      setSelectedDrawingId(null);
      editDragRef.current = null;
    }
    redrawOverlay();
  }, [drawingTool, symbol, redrawOverlay]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || !drawingTool) return undefined;

    const handler = (param) => {
      if (!param.point || param.time == null) return;
      const price = series.coordinateToPrice(param.point.y);
      if (price == null) return;
      void placeDrawingAt(param.time, price);
    };

    chart.subscribeClick(handler);
    return () => chart.unsubscribeClick(handler);
  }, [drawingTool, placeDrawingAt]);

  useEffect(() => {
    redrawOverlay();
  }, [drawings, selectedDrawingId, redrawOverlay]);

  useEffect(() => {
    if (selectedDrawingId == null) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
      e.preventDefault();
      const id = selectedDrawingId;
      void deleteChartDrawing(id);
      setDrawings((prev) => prev.filter((d) => d.id !== id));
      setSelectedDrawingId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedDrawingId, setDrawings]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const rows = await fetchChartDrawings(symbol);
      if (!cancelled) setDrawings(rows);
    }
    load();
    pendingDrawRef.current = null;
    return () => {
      cancelled = true;
    };
  }, [symbol, setDrawings]);

  const applyCandlesToChart = useCallback(
    (historical) => {
      candlesRef.current = historical;
      seriesRef.current?.setData(historical);
      setFollowLive(false);
      if (chartRef.current) {
        applyChartFollowLive(chartRef.current, false, barSpacingRef);
        applyDefaultVisibleRange(chartRef.current, historical.length);
      }
      setLatestChartSignal(null);
      setSlPrice(null);
      setBePrice(null);
      removeGuideLines();
      runAnalysis(historical);
      const last0 = historical[historical.length - 1];
      if (last0) {
        setMarketPrice(last0.close);
        setCurrentSpread(computeDynamicSpread(symbol, { tickIndex: 0 }));
        void processMarketTick(last0);
      }
    },
    [
      removeGuideLines,
      runAnalysis,
      setLatestChartSignal,
      setMarketPrice,
      setCurrentSpread,
      processMarketTick,
      symbol,
    ],
  );

  const ingestCandleFile = useCallback(
    async (file) => {
      if (!file) return;
      const text = await file.text();
      const candles = parseCandleFile(text, file.name, symbol);
      if (!candles.length) {
        setFeedHint('Fichier illisible — colonnes time, open, high, low, close requises.');
        return;
      }
      setImportedSeries({
        symbol,
        label: file.name,
        candles,
        importedAt: Date.now(),
      });
      setFeedHint(`${candles.length} bougies importées depuis ${file.name}.`);
    },
    [setImportedSeries, symbol],
  );

  useEffect(() => {
    setFeedPaused(false);
    setFollowLive(false);
  }, [symbol, timeframe]);

  useEffect(() => {
    let cancelled = false;

    const useImport =
      importedSeries?.candles?.length > 0 && importedSeries.symbol === symbol;
    const provider = normalizeMarketProvider(settings?.market_provider);
    const useLive = !useImport && isLiveMarketProvider(provider);
    const useDemo = !useImport && isDemoMarketProvider(provider);

    async function loadSeries() {
      tickRef.current = 0;
      feedRuntimeRef.current.feed?.stop?.();

      if (useImport) {
        feedRuntimeRef.current = { mode: 'import' };
        if (!cancelled) {
          applyCandlesToChart(importedSeries.candles);
          setFeedHint('');
          setFeedVersion((v) => v + 1);
        }
        return;
      }

      if (useLive) {
        try {
          const historical = await fetchLiveCandlesFromMain({
            provider,
            apiKey: settings?.market_api_key ?? '',
            symbol,
            timeframe,
          });
          if (cancelled) return;
          if (!historical.length) {
            throw new Error('Aucune bougie reçue.');
          }
          feedRuntimeRef.current.feed?.stop?.();
          feedRuntimeRef.current = {
            mode: 'live',
            provider,
            apiKey: settings?.market_api_key ?? '',
          };
          applyCandlesToChart(historical);
          setFeedHint('');
          setFeedVersion((v) => v + 1);
        } catch (error) {
          if (cancelled) return;
          const msg = error instanceof Error ? error.message : 'Live indisponible.';
          setFeedHint(`${msg} — retour flux Twelve Data local.`);
          const feed = createTwelveDataFeed({ symbol, timeframe });
          feed.subscribe(symbol, { timeframe });
          const historical = generateHistoricalCandles(symbol, timeframe, SIM_HISTORICAL_COUNT);
          feed.seedCandles(historical);
          feedRuntimeRef.current = { mode: 'sim', feed };
          applyCandlesToChart(historical);
          setFeedVersion((v) => v + 1);
        }
        return;
      }

      if (useDemo || !useLive) {
        const feed = createTwelveDataFeed({ symbol, timeframe });
        feed.subscribe(symbol, { timeframe });
        const historical = generateHistoricalCandles(symbol, timeframe, SIM_HISTORICAL_COUNT);
        feed.seedCandles(historical);
        feedRuntimeRef.current = { mode: 'sim', feed, demo: true };
        if (!cancelled) {
          applyCandlesToChart(historical);
          setFeedHint('');
          setFeedVersion((v) => v + 1);
        }
        return;
      }
    }

    loadSeries();

    return () => {
      cancelled = true;
    };
  }, [
    symbol,
    timeframe,
    settings?.market_provider,
    settings?.market_api_key,
    importedSeries,
    applyCandlesToChart,
  ]);

  useEffect(() => {
    if (feedPaused || replayActive) return undefined;

    const rt = feedRuntimeRef.current;
    if (rt.mode === 'import') return undefined;

    let cancelled = false;
    let pollInterval = null;
    let offTick = null;

    if (rt.mode === 'live') {
      pollInterval = setInterval(async () => {
        if (cancelled || feedPaused) return;
        try {
          const fresh = await fetchLiveCandlesFromMain({
            provider: rt.provider,
            apiKey: rt.apiKey ?? '',
            symbol,
            timeframe,
          });
          if (cancelled || !fresh.length) return;
          candlesRef.current = fresh;
          seriesRef.current?.setData(fresh);
          const last = fresh[fresh.length - 1];
          queueTickUiUpdates({
            marketPrice: last.close,
            monitorCandle: last,
            analysisCandles: fresh,
          });
          if (followLive && chartRef.current) {
            chartRef.current.timeScale().scrollToRealTime();
          }
        } catch {
          /* garder la série actuelle */
        }
      }, 60000);
    } else {
      const feed = rt.feed;
      if (feed) {
        feed.stop();
        if (candlesRef.current.length) {
          feed.seedCandles(candlesRef.current);
        }
        offTick = feed.onTick((tick) => {
          if (cancelled || feedPaused) return;
          tickRef.current += 1;
          candlesRef.current = tick.candles;
          seriesRef.current?.update(tick.candle);
          queueTickUiUpdates({
            marketPrice: tick.price,
            spread: tick.spread,
            monitorCandle: tick.candle,
            analysisCandles: tick.candles,
          });
          if (followLive && chartRef.current) {
            chartRef.current.timeScale().scrollToRealTime();
          }
        });
        feed.start(900);
      }
    }

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      offTick?.();
      rt.feed?.stop?.();
      if (tickUiFlushTimerRef.current) {
        clearTimeout(tickUiFlushTimerRef.current);
        tickUiFlushTimerRef.current = null;
      }
    };
  }, [
    feedPaused,
    replayActive,
    feedVersion,
    symbol,
    timeframe,
    followLive,
    queueTickUiUpdates,
  ]);

  const feedIsStatic =
    importedSeries?.candles?.length > 0 && importedSeries.symbol === symbol;

  const pauseDirect = () => {
    setFeedPaused(true);
    setFollowLive(false);
    if (chartRef.current) {
      applyChartFollowLive(chartRef.current, false, barSpacingRef);
    }
  };

  const clearTradeReviewOverlay = useCallback(() => {
    const series = seriesRef.current;
    if (!series) return;
    for (const line of tradeReviewPriceLinesRef.current) {
      series.removePriceLine(line);
    }
    tradeReviewPriceLinesRef.current = [];
    series.setMarkers(buildMarkers(lastAssetSignalsRef.current));
  }, []);

  const applyTradeFocusOnChart = useCallback(
    (trade) => {
      const chart = chartRef.current;
      const series = seriesRef.current;
      if (!chart || !series || !trade) return;

      pauseDirect();

      const candles = candlesRef.current;
      if (!candles.length) return;

      const idx = findCandleIndexForTrade(candles, trade);
      chart.timeScale().setVisibleLogicalRange(visibleRangeAroundIndex(idx, candles.length));

      for (const line of tradeReviewPriceLinesRef.current) {
        series.removePriceLine(line);
      }
      tradeReviewPriceLinesRef.current = [];

      const pushLine = (price, color, title) => {
        if (price == null || price === '') return;
        const n = Number(price);
        if (!Number.isFinite(n)) return;
        tradeReviewPriceLinesRef.current.push(
          series.createPriceLine({
            price: n,
            color,
            lineWidth: 2,
            axisLabelVisible: true,
            title,
          }),
        );
      };

      pushLine(
        trade.entry_price,
        trade.type === 'BUY' ? '#22c55e' : '#f43f5e',
        `Entrée #${trade.id}`,
      );
      pushLine(trade.stop_loss, '#f97316', 'SL trade');
      pushLine(trade.take_profit, '#a78bfa', 'TP');
      pushLine(trade.exit_price, '#38bdf8', 'Sortie');

      const barTime = candles[idx]?.time;
      const markers = [...buildMarkers(lastAssetSignalsRef.current)];
      if (barTime != null) {
        markers.push({
          time: barTime,
          position: trade.type === 'BUY' ? 'belowBar' : 'aboveBar',
          color: trade.type === 'BUY' ? '#22c55e' : '#f43f5e',
          shape: trade.type === 'BUY' ? 'arrowUp' : 'arrowDown',
          text: `#${trade.id}`,
        });
        markers.sort((a, b) => a.time - b.time);
      }
      series.setMarkers(markers);

      if (trade.stop_loss != null && Number.isFinite(Number(trade.stop_loss))) {
        const sl = Number(trade.stop_loss);
        setSlPrice(sl);
        setActiveStopLoss(sl);
        applyGuideLines(sl, bePrice);
      }
    },
    [applyGuideLines, bePrice, setActiveStopLoss],
  );

  const resumeDirect = () => {
    setFeedPaused(false);
    setFollowLive(true);
    if (chartRef.current) {
      applyChartFollowLive(chartRef.current, true, barSpacingRef);
      chartRef.current.timeScale().scrollToRealTime();
    }
  };

  useEffect(() => {
    if (!activeTradeReview?.trade || !activeTradeReview.seq) return;
    const trade = activeTradeReview.trade;
    if (trade.symbol !== symbol) return;
    if (!candlesRef.current.length) return;
    applyTradeFocusOnChart(trade);
  }, [activeTradeReview, symbol, feedVersion, applyTradeFocusOnChart]);

  useEffect(() => {
    registerChartControls({
      zoomIn: () => adjustZoom(chartRef.current, barSpacingRef, 'in'),
      zoomOut: () => adjustZoom(chartRef.current, barSpacingRef, 'out'),
      pauseFeed: pauseDirect,
      resumeFeed: resumeDirect,
      captureForReplay: () => {
        pauseDirect();
        return [...candlesRef.current];
      },
      applyReplayFrame: (frame, candles) => {
        const source = candles ?? candlesRef.current;
        const slice = source.slice(0, frame);
        if (slice.length) {
          seriesRef.current?.setData(slice);
          redrawOverlay();
        }
      },
      clearTradeReviewOverlay,
      applyTradeFocusOnChart,
    });
    return () => registerChartControls(null);
  }, [
    registerChartControls,
    feedPaused,
    followLive,
    clearTradeReviewOverlay,
    applyTradeFocusOnChart,
    redrawOverlay,
  ]);

  const feedBadge = resolveMarketFeedLabel(
    settings,
    importedSeries?.symbol === symbol ? importedSeries : null,
  );
  const badgeClass =
    feedBadge.tone === 'emerald'
      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
      : feedBadge.tone === 'sky'
        ? 'border-sky-500/35 bg-sky-500/10 text-sky-200'
        : 'border-amber-500/35 bg-amber-500/10 text-amber-200';

  useEffect(() => {
    setActiveStopLoss(slPrice);
  }, [slPrice, setActiveStopLoss]);

  useEffect(() => {
    if (activeStopLoss != null && Math.abs((slPrice ?? 0) - activeStopLoss) > 0.0001) {
      setSlPrice(activeStopLoss);
    }
  }, [activeStopLoss, slPrice]);

  useEffect(() => {
    if (slPrice != null || bePrice != null) {
      applyGuideLines(slPrice, bePrice);
    }
  }, [slPrice, bePrice, applyGuideLines]);

  const finishEditDrag = useCallback(async () => {
    const drag = editDragRef.current;
    editDragRef.current = null;
    if (!drag) return;
    const drawing = drawingsRef.current.find((d) => d.id === drag.id);
    const bridge = bridgeRef.current;
    if (drawing && bridge) {
      await bridge.persistDrawing(symbol, {
        id: drawing.id,
        type: drawing.type,
        coordinates: drawing.coordinates,
      });
    }
  }, [symbol]);

  const onChartPointerDown = (e) => {
    if (drawingTool) return;
    if (!chartHostRef.current || !seriesRef.current || !chartRef.current) return;
    const rect = chartHostRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const x = e.clientX - rect.left;
    if (hitTestPrice(y, slPrice)) {
      setDragTarget('sl');
      e.stopPropagation();
      return;
    }
    if (hitTestPrice(y, bePrice)) {
      setDragTarget('be');
      e.stopPropagation();
      return;
    }

    const hit = hitTestDrawings(
      drawingsRef.current,
      x,
      y,
      chartRef.current,
      seriesRef.current,
    );
    if (hit) {
      const d = drawingsRef.current.find((item) => item.id === hit.id);
      if (!d) return;
      setSelectedDrawingId(hit.id);
      editDragRef.current = {
        id: hit.id,
        handle: hit.handle === 'line' ? 'body' : hit.handle,
        startX: x,
        startY: y,
        snapshot: JSON.parse(JSON.stringify(d.coordinates)),
      };
      wrapRef.current?.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setSelectedDrawingId(null);
  };

  const onChartPointerMove = (e) => {
    if (!chartHostRef.current || !seriesRef.current || !chartRef.current) return;
    const rect = chartHostRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const x = e.clientX - rect.left;

    const drag = editDragRef.current;
    if (drag) {
      const drawing = drawingsRef.current.find((d) => d.id === drag.id);
      if (drawing) {
        const handle =
          drawing.type === 'horizontal' ? 'line' : drag.handle;
        const updated = applyDrawingDrag({
          drawing,
          handle: handle === 'line' ? 'body' : handle,
          startPointer: { x: drag.startX, y: drag.startY },
          currentPointer: { x, y },
          chart: chartRef.current,
          series: seriesRef.current,
          snapshot: drag.snapshot,
        });
        setDrawings((prev) =>
          prev.map((d) => (d.id === drag.id ? { ...d, coordinates: updated.coordinates } : d)),
        );
      }
      e.preventDefault();
      return;
    }

    if (!dragTarget || !seriesRef.current) return;
    const price = seriesRef.current.coordinateToPrice(y);
    if (price == null) return;
    const rounded = Number(price.toFixed(2));
    if (dragTarget === 'sl') {
      setSlPrice(rounded);
      if (latestChartSignal?.entry != null) {
        const risk = Math.abs(latestChartSignal.entry - rounded);
        const be =
          latestChartSignal.direction === 'BUY'
            ? latestChartSignal.entry + risk * 1.5
            : latestChartSignal.entry - risk * 1.5;
        setBePrice(Number(be.toFixed(2)));
      }
    }
    if (dragTarget === 'be') setBePrice(rounded);
  };

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#0b0f14]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 px-3 py-1.5 text-[11px] text-slate-500">
        <span className="flex flex-wrap items-center gap-2">
          <span>
            {symbol} · {timeframe}
          </span>
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}
            title={feedBadge.title}
          >
            {feedBadge.short}
          </span>
          {feedPaused && !feedIsStatic && (
            <span
              className="rounded border border-rose-500/35 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-200"
              title="Flux figé — zoomez, analysez, puis Reprendre le direct"
            >
              Direct en pause
            </span>
          )}
          {feedHint && (
            <span className="text-[10px] text-amber-300" title={feedHint}>
              {feedHint.length > 48 ? `${feedHint.slice(0, 48)}…` : feedHint}
            </span>
          )}
          {drawingTool && (
            <span className="ml-2 text-sky-400">
              Tracé actif — cliquez sur le graphique
              {drawHint ? ` · ${drawHint}` : ''}
            </span>
          )}
          {!drawingTool && selectedDrawingId != null && (
            <span className="ml-2 text-amber-200/90">
              Tracé sélectionné — glisser pour déplacer · poignées pour ajuster · Suppr pour effacer
            </span>
          )}
          {!drawingTool && selectedDrawingId == null && (
            <span className="ml-2 hidden text-slate-600 sm:inline">
              Sélection : cliquer un tracé pour le modifier
            </span>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="hidden text-[10px] text-slate-600 sm:inline">
            Molette : zoom · Glisser : déplacer
          </span>
          <button
            type="button"
            title="Télécharger un modèle CSV"
            className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-300 hover:border-slate-500"
            onClick={() => downloadSampleCsv()}
          >
            Modèle CSV
          </button>
          <button
            type="button"
            title="Importer CSV ou JSON (OHLC)"
            className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-300 hover:border-slate-500"
            onClick={() => fileInputRef.current?.click()}
          >
            Importer
          </button>
          {importedSeries?.symbol === symbol && importedSeries?.candles?.length > 0 && (
            <button
              type="button"
              title="Revenir au flux simulé ou live"
              className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-400 hover:border-slate-500"
              onClick={() => {
                clearImportedSeries();
                setFeedHint('');
              }}
            >
              Effacer import
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              void ingestCandleFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            title="Zoom arrière"
            className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-300 hover:border-slate-500"
            onClick={() => adjustZoom(chartRef.current, barSpacingRef, 'out')}
          >
            −
          </button>
          <button
            type="button"
            title="Zoom avant"
            className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-300 hover:border-slate-500"
            onClick={() => adjustZoom(chartRef.current, barSpacingRef, 'in')}
          >
            +
          </button>
          <button
            type="button"
            title="Gros plan sur les dernières bougies"
            className="rounded border border-sky-600/40 bg-sky-600/15 px-2 py-0.5 text-sky-200 hover:border-sky-500"
            onClick={() => {
              if (chartRef.current && candlesRef.current.length) {
                applyCloseUpZoom(chartRef.current, candlesRef.current.length, barSpacingRef);
              }
            }}
          >
            Zoom marché
          </button>
          <button
            type="button"
            title="Recentrer sur les dernières bougies"
            className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-300 hover:border-slate-500"
            onClick={() => {
              if (chartRef.current && candlesRef.current.length) {
                applyDefaultVisibleRange(chartRef.current, candlesRef.current.length);
              }
            }}
          >
            Réinitialiser
          </button>
          <button
            type="button"
            title="Afficher plus de bougies (contexte temporel)"
            className="rounded border border-violet-600/40 bg-violet-600/15 px-2 py-0.5 text-violet-200 hover:border-violet-500"
            onClick={() => {
              if (chartRef.current && candlesRef.current.length) {
                applyExtendedVisibleRange(
                  chartRef.current,
                  candlesRef.current.length,
                  barSpacingRef,
                );
              }
            }}
          >
            Vue longue
          </button>
          {!feedIsStatic && !feedPaused && (
            <button
              type="button"
              title="Figer le flux pour zoomer et simuler sur l’historique"
              className="rounded border border-amber-600/40 bg-amber-600/15 px-2 py-0.5 text-amber-100 hover:border-amber-500"
              onClick={pauseDirect}
            >
              Pause direct
            </button>
          )}
          {!feedIsStatic && feedPaused && (
            <button
              type="button"
              title="Relancer mises à jour et suivi de la dernière bougie"
              className="rounded border border-emerald-600/50 bg-emerald-600/25 px-2 py-0.5 font-medium text-emerald-100 hover:border-emerald-400"
              onClick={resumeDirect}
            >
              Reprendre le direct
            </button>
          )}
          <button
            type="button"
            title="Défilement auto sur la dernière bougie (flux actif)"
            disabled={feedPaused || feedIsStatic}
            className={`rounded border px-2 py-0.5 disabled:opacity-35 ${
              followLive && !feedPaused
                ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
            }`}
            onClick={() => {
              if (feedPaused) return;
              setFollowLive((v) => {
                const next = !v;
                if (chartRef.current) {
                  applyChartFollowLive(chartRef.current, next, barSpacingRef);
                }
                return next;
              });
            }}
          >
            Suivre
          </button>
        </div>
        {latestChartSignal && (
          <span className="w-full text-slate-400 sm:w-auto">
            {latestChartSignal.pattern} · SL{' '}
            <span className="tabular-nums text-orange-400">
              {latestChartSignal.stopLoss?.toFixed(2)}
            </span>
          </span>
        )}
      </div>
      <div
        ref={wrapRef}
        className={`relative min-h-0 flex-1 ${drawingTool ? 'cursor-crosshair' : selectedDrawingId != null ? 'cursor-grab' : ''}`}
        onPointerDown={onChartPointerDown}
        onPointerMove={onChartPointerMove}
        onPointerUp={(e) => {
          if (editDragRef.current) {
            void finishEditDrag();
            try {
              wrapRef.current?.releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }
          setDragTarget(null);
        }}
        onPointerLeave={(e) => {
          if (editDragRef.current) {
            void finishEditDrag();
            try {
              wrapRef.current?.releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }
          setDragTarget(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          void ingestCandleFile(file);
        }}
        style={{ touchAction: 'none' }}
      >
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center border-2 border-dashed border-sky-400/60 bg-sky-500/10 text-sm text-sky-200">
            Déposez un CSV ou JSON OHLC
          </div>
        )}
        <div ref={chartHostRef} className="absolute inset-0 z-0" />
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 z-[2]"
          aria-hidden
        />
        {activeTradeReview?.trade && (
          <TradeReviewBanner
            review={activeTradeReview}
            onClose={clearTradeChartReview}
            onOpenDetails={(id) => {
              window.dispatchEvent(
                new CustomEvent('nexatrader:open-trade', { detail: { tradeId: id } }),
              );
            }}
          />
        )}
      </div>
    </div>
  );
});
