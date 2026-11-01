/** Providers utilisant le moteur Twelve Data local (démo, sans clé). */
export const DEMO_MARKET_PROVIDERS = new Set(['twelve_data_demo', 'simulated']);

/** Providers nécessitant une clé API et le bridge Electron. */
export const LIVE_MARKET_PROVIDERS = new Set(['twelve_data', 'finnhub']);

export function normalizeMarketProvider(provider) {
  const p = provider ?? 'twelve_data_demo';
  if (p === 'simulated') return 'twelve_data_demo';
  return p;
}

export function isDemoMarketProvider(provider) {
  return DEMO_MARKET_PROVIDERS.has(normalizeMarketProvider(provider));
}

export function isLiveMarketProvider(provider) {
  return LIVE_MARKET_PROVIDERS.has(provider);
}

export function liveProviderRequiresApiKey(provider) {
  return isLiveMarketProvider(provider);
}
