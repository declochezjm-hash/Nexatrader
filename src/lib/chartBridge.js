import { fetchChartDrawings, saveChartDrawing, updateChartDrawing } from '../lib/chartDrawings.js';

export function createChartBridge(chart, series, containerEl) {
  return {
    chart,
    series,
    containerEl,
    timeToCoordinate(time) {
      return chart.timeScale().timeToCoordinate(time);
    },
    priceToCoordinate(price) {
      return series.priceToCoordinate(price);
    },
    coordinateToTime(x) {
      return chart.timeScale().coordinateToTime(x);
    },
    coordinateToPrice(y) {
      return series.coordinateToPrice(y);
    },
    subscribeVisibleRange(cb) {
      chart.timeScale().subscribeVisibleLogicalRangeChange(cb);
      return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(cb);
    },
    async persistDrawing(symbol, drawing) {
      if (drawing.id) {
        await updateChartDrawing(drawing.id, drawing);
        return drawing.id;
      }
      const id = await saveChartDrawing(symbol, drawing.type, drawing.coordinates);
      return id;
    },
    async loadDrawings(symbol) {
      return fetchChartDrawings(symbol);
    },
  };
}
