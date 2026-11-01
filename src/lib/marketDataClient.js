/**
 * Client renderer — bougies live via IPC Electron (évite CORS).
 */

export async function fetchLiveCandlesFromMain({ provider, apiKey, symbol, timeframe }) {
  if (typeof window === 'undefined' || !window.nexaTrader?.market?.fetchCandles) {
    throw new Error('Données live disponibles uniquement dans la fenêtre desktop Electron.');
  }
  const res = await window.nexaTrader.market.fetchCandles({
    provider,
    apiKey,
    symbol,
    timeframe,
  });
  if (res?.ok === false) {
    throw new Error(res.error ?? 'Échec récupération marché live.');
  }
  return res.data?.candles ?? [];
}

export async function testMarketConnectionFromMain({ provider, apiKey, symbol }) {
  if (!window.nexaTrader?.market?.testConnection) {
    throw new Error('Test marché indisponible (Electron requis).');
  }
  const res = await window.nexaTrader.market.testConnection({ provider, apiKey, symbol });
  if (res?.ok === false) {
    throw new Error(res.error ?? 'Test échoué.');
  }
  return res.data;
}

export function resolveMarketFeedLabel(settings, importedSeries) {
  if (importedSeries?.candles?.length) {
    return {
      tone: 'sky',
      short: 'Import fichier',
      title: `Graphique importé (${importedSeries.candles.length} bougies)`,
    };
  }
  const provider = settings?.market_provider ?? 'simulated';
  if (provider === 'twelve_data') {
    return {
      tone: 'emerald',
      short: 'Live Twelve Data',
      title: 'Cotations via API Twelve Data (gratuit avec clé)',
    };
  }
  if (provider === 'finnhub') {
    return {
      tone: 'emerald',
      short: 'Live Finnhub',
      title: 'Cotations via API Finnhub (gratuit avec clé)',
    };
  }
  return {
    tone: 'amber',
    short: 'Simulation locale',
    title: 'Bougies générées localement — pas de broker',
  };
}
