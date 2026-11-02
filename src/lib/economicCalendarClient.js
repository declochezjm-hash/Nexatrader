import { setExternalEconomicCalendar } from '../engine/newsFilter.js';

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Charge le calendrier réel (Finnhub) via IPC Electron, sinon garde la simulation.
 * @param {object|null|undefined} settings
 */
export async function refreshEconomicCalendarFromSettings(settings) {
  const apiKey = settings?.market_api_key?.trim();
  const provider = settings?.market_provider ?? 'simulated';

  if (!apiKey || provider === 'simulated' || provider === 'twelve_data_demo') {
    setExternalEconomicCalendar(null);
    return { ok: true, source: 'simulated', count: 0 };
  }

  const invoke = window.nexaTrader?.calendar?.fetch;
  if (!invoke) {
    setExternalEconomicCalendar(null);
    return { ok: false, error: 'IPC calendrier indisponible (mode navigateur).' };
  }

  const from = new Date();
  const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  const res = await invoke({
    apiKey,
    from: formatDate(from),
    to: formatDate(to),
  });

  if (res?.ok && res.data?.events?.length) {
    const events = res.data.events.map((e) => ({
      ...e,
      timeUtc: new Date(e.timeUtc),
    }));
    setExternalEconomicCalendar(events);
    return { ok: true, source: 'finnhub', count: events.length };
  }

  setExternalEconomicCalendar(null);
  return {
    ok: res?.ok ?? false,
    source: 'simulated',
    count: 0,
    error: res?.error,
  };
}
