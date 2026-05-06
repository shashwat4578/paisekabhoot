// ==================================================
// mfapi.js — Real data fetcher from api.mfapi.in
// ==================================================

const BASE_URL = 'https://api.mfapi.in/mf';

/**
 * Search mutual fund schemes by name.
 * Returns: [{ schemeCode, schemeName }]
 */
export async function searchSchemes(query) {
  if (!query || query.length < 2) return [];
  try {
    const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    // data is an array of { schemeCode, schemeName }
    return data.slice(0, 30);
  } catch (e) {
    console.error('searchSchemes error:', e);
    return [];
  }
}

/**
 * Fetch full scheme data including NAV history.
 * Returns: { meta: {...}, data: [{ date, nav }] }
 */
export async function fetchSchemeData(schemeCode) {
  try {
    const res = await fetch(`${BASE_URL}/${schemeCode}`);
    if (!res.ok) throw new Error(`Failed to fetch scheme ${schemeCode}`);
    const data = await res.json();
    if (data.status !== 'SUCCESS') throw new Error('API returned non-success');
    return data;
  } catch (e) {
    console.error('fetchSchemeData error:', e);
    return null;
  }
}

/**
 * Get latest NAV for a scheme.
 */
export async function getLatestNAV(schemeCode) {
  const data = await fetchSchemeData(schemeCode);
  if (!data || !data.data || data.data.length === 0) return null;
  return {
    nav: parseFloat(data.data[0].nav),
    date: data.data[0].date,
    meta: data.meta,
  };
}

/**
 * Parse dd-mm-yyyy to Date object.
 */
export function parseDate(dateStr) {
  const [d, m, y] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Get NAV closest to a specific date from history.
 */
export function getNAVOnDate(navHistory, targetDate) {
  const target = targetDate instanceof Date ? targetDate : new Date(targetDate);
  let closest = null;
  let minDiff = Infinity;
  for (const entry of navHistory) {
    const entryDate = parseDate(entry.date);
    const diff = Math.abs(entryDate - target);
    if (diff < minDiff) {
      minDiff = diff;
      closest = entry;
    }
  }
  return closest ? parseFloat(closest.nav) : null;
}

/**
 * Calculate 1Y, 3Y, 5Y returns from NAV history.
 * Returns: { return1Y, return3Y, return5Y } as percentages.
 */
export function calculateReturns(navHistory) {
  if (!navHistory || navHistory.length === 0) return {};
  const latestNAV = parseFloat(navHistory[0].nav);
  const latestDate = parseDate(navHistory[0].date);

  const getReturn = (years) => {
    const pastDate = new Date(latestDate);
    pastDate.setFullYear(pastDate.getFullYear() - years);
    const pastNAV = getNAVOnDate(navHistory, pastDate);
    if (!pastNAV) return null;
    if (years === 1) {
      return ((latestNAV - pastNAV) / pastNAV) * 100;
    }
    // CAGR for multi-year
    return (Math.pow(latestNAV / pastNAV, 1 / years) - 1) * 100;
  };

  return {
    return1Y: getReturn(1),
    return3Y: getReturn(3),
    return5Y: getReturn(5),
  };
}

/**
 * Calculate daily P&L (today vs yesterday).
 */
export function calculateDailyPnL(navHistory, units) {
  if (!navHistory || navHistory.length < 2) return null;
  const todayNAV = parseFloat(navHistory[0].nav);
  const yesterdayNAV = parseFloat(navHistory[1].nav);
  const change = todayNAV - yesterdayNAV;
  const changePct = (change / yesterdayNAV) * 100;
  return {
    change: change * units,
    changePct,
    todayNAV,
    yesterdayNAV,
  };
}

/**
 * XIRR Calculation using Newton-Raphson method.
 * cashFlows: [{ amount: number, date: Date }]
 * Negative amounts = investments, Positive amounts = redemptions / current value.
 */
export function calculateXIRR(cashFlows, guess = 0.1) {
  if (!cashFlows || cashFlows.length < 2) return null;

  const sorted = [...cashFlows].sort((a, b) => a.date - b.date);
  const d0 = sorted[0].date;

  const daysDiff = (d) => (d - d0) / (365.25 * 24 * 60 * 60 * 1000);

  const f = (rate) => {
    return sorted.reduce((sum, cf) => {
      const t = daysDiff(cf.date);
      return sum + cf.amount / Math.pow(1 + rate, t);
    }, 0);
  };

  const df = (rate) => {
    return sorted.reduce((sum, cf) => {
      const t = daysDiff(cf.date);
      return sum + (-t * cf.amount) / Math.pow(1 + rate, t + 1);
    }, 0);
  };

  let rate = guess;
  for (let i = 0; i < 1000; i++) {
    const fVal = f(rate);
    const dfVal = df(rate);
    if (Math.abs(dfVal) < 1e-10) break;
    const newRate = rate - fVal / dfVal;
    if (Math.abs(newRate - rate) < 1e-10) return newRate * 100;
    rate = newRate;
    if (rate < -0.99) rate = -0.99;
  }
  return rate * 100;
}
