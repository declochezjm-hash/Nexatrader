/**
 * Calendrier économique à fort impact (simulation + dates calculées).
 */

function firstFriday(year, monthIndex) {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  while (d.getUTCDay() !== 5) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

function midMonthDay(year, monthIndex, day = 13) {
  return new Date(Date.UTC(year, monthIndex, day));
}

function fomcDates(year) {
  return [
    new Date(Date.UTC(year, 0, 29, 19, 0)),
    new Date(Date.UTC(year, 2, 19, 19, 0)),
    new Date(Date.UTC(year, 4, 7, 19, 0)),
    new Date(Date.UTC(year, 5, 18, 19, 0)),
    new Date(Date.UTC(year, 6, 30, 19, 0)),
    new Date(Date.UTC(year, 8, 17, 19, 0)),
    new Date(Date.UTC(year, 10, 5, 19, 0)),
    new Date(Date.UTC(year, 11, 17, 19, 0)),
  ];
}

function buildEventDate(baseDate, hourUtc, minuteUtc) {
  const d = new Date(baseDate);
  d.setUTCHours(hourUtc, minuteUtc, 0, 0);
  return d;
}

/**
 * @param {Date} [referenceDate]
 * @returns {Array<{ code: string, label: string, timeUtc: Date, symbols: string[] }>}
 */
export function getHighImpactEvents(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const symbols = ['XAUUSD', 'NAS100'];
  const events = [];

  const nfpDay = firstFriday(year, month);
  events.push({
    code: 'NFP',
    label: 'Non-Farm Payrolls (NFP)',
    timeUtc: buildEventDate(nfpDay, 13, 30),
    symbols,
  });

  const cpiDay = midMonthDay(year, month, 12);
  events.push({
    code: 'CPI',
    label: 'CPI (inflation US)',
    timeUtc: buildEventDate(cpiDay, 13, 30),
    symbols,
  });

  for (const fomc of fomcDates(year)) {
    events.push({
      code: 'FOMC',
      label: 'FOMC — décision de taux',
      timeUtc: fomc,
      symbols,
    });
  }

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const nfpNext = firstFriday(nextYear, nextMonth);
  events.push({
    code: 'NFP',
    label: 'Non-Farm Payrolls (NFP)',
    timeUtc: buildEventDate(nfpNext, 13, 30),
    symbols,
  });

  return events.sort((a, b) => a.timeUtc - b.timeUtc);
}

/**
 * @param {string} symbol
 * @param {number} [bufferMinutes=15]
 * @param {Date} [now=new Date()]
 */
export function isNearNews(symbol, bufferMinutes = 15, now = new Date()) {
  const events = getHighImpactEvents(now);
  const nowMs = now.getTime();

  for (const event of events) {
    if (!event.symbols.includes(symbol)) continue;
    const deltaMin = Math.abs(nowMs - event.timeUtc.getTime()) / 60000;
    if (deltaMin <= bufferMinutes) {
      return {
        near: true,
        event,
        minutesToEvent: Number(((event.timeUtc.getTime() - nowMs) / 60000).toFixed(1)),
      };
    }
  }

  return { near: false, event: null, minutesToEvent: null };
}

export function getUpcomingNews(symbol, withinHours = 24, now = new Date()) {
  const events = getHighImpactEvents(now);
  const horizon = withinHours * 60 * 60 * 1000;
  return events.filter(
    (e) =>
      e.symbols.includes(symbol) &&
      e.timeUtc.getTime() >= now.getTime() &&
      e.timeUtc.getTime() - now.getTime() <= horizon,
  );
}
