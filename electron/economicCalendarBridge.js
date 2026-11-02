/**
 * Calendrier économique Finnhub (option clé API marché).
 * @param {string} apiKey
 * @param {string} from YYYY-MM-DD
 * @param {string} to YYYY-MM-DD
 */
export async function fetchFinnhubEconomicCalendar(apiKey, from, to) {
  if (!apiKey?.trim()) {
    return { ok: false, error: 'Clé Finnhub manquante (Paramètres → Marché).' };
  }

  const url = new URL('https://finnhub.io/api/v1/calendar/economic');
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  url.searchParams.set('token', apiKey.trim());

  const res = await fetch(url.toString());
  if (!res.ok) {
    return { ok: false, error: `Finnhub ${res.status}` };
  }

  const json = await res.json();
  const rows = json?.economicCalendar ?? json?.data ?? [];
  const symbols = ['XAUUSD', 'NAS100'];

  const events = rows
    .filter((row) => {
      const impact = String(row.impact ?? row.importance ?? '').toLowerCase();
      return impact.includes('high') || impact === '3' || row.country === 'US';
    })
    .map((row) => {
      const dateStr = row.date ?? row.time ?? row.datetime;
      const timeUtc = dateStr ? new Date(dateStr) : new Date();
      return {
        code: String(row.event ?? row.title ?? 'NEWS').slice(0, 12).toUpperCase(),
        label: row.event ?? row.title ?? 'Annonce économique',
        timeUtc,
        symbols,
      };
    })
    .filter((e) => !Number.isNaN(e.timeUtc.getTime()));

  return { ok: true, events };
}
