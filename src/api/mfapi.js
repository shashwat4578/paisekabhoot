import { supabase } from './supabaseClient'

const PERF_COLUMNS = [
  'return_1d_abs', 'return_1d_ann',
  'return_1w_abs', 'return_1w_ann',
  'return_1m_abs', 'return_1m_ann',
  'return_3m_abs', 'return_3m_ann',
  'return_6m_abs', 'return_6m_ann',
  'return_1y_abs', 'return_1y_ann',
  'return_2y_abs', 'return_2y_ann',
  'return_3y_abs', 'return_3y_ann',
  'return_5y_abs', 'return_5y_ann',
  'return_10y_abs', 'return_10y_ann',
  'return_inception_abs', 'return_inception_ann'
];

/**
 * Search mutual fund schemes by name in Supabase.
 * Optimized for keywords (e.g. "Axis Bluechip" matches "Axis Bluechip Fund")
 * Returns: [{ schemeCode, schemeName, latestNav, performance: { ... } }]
 */
export async function searchSchemes(query) {
  if (!query || query.length < 2) return [];
  try {
    const keywords = query.trim().split(/\s+/).filter(k => k.length > 0);
    let dbQuery = supabase
      .from('mutual_funds')
      .select(`
        scheme_code, 
        scheme_name,
        fund_performance (
          latest_nav,
          ${PERF_COLUMNS.join(',\n          ')}
        )
      `);

    // Apply AND logic for keywords
    keywords.forEach(word => {
      dbQuery = dbQuery.ilike('scheme_name', `%${word}%`);
    });

    const { data, error } = await dbQuery.limit(30);

    if (error) throw error;
    
    return data.map(f => {
      let perf = null;
      if (f.fund_performance) {
        perf = Array.isArray(f.fund_performance) ? f.fund_performance[0] : f.fund_performance;
      }
      
      const performance = {};
      if (perf) {
        PERF_COLUMNS.forEach(col => {
          performance[col] = perf[col];
        });
      }

      return {
        schemeCode: f.scheme_code,
        schemeName: f.scheme_name,
        latestNav: perf ? perf.latest_nav : null,
        performance: perf ? performance : null
      };
    });
  } catch (e) {
    console.error('searchSchemes error:', e);
    return [];
  }
}

/**
 * Fetch live data from Supabase for Portfolio Dashboard.
 * Returns: { nav, navDate, returns: { ... }, dailyPnL }
 */
export async function fetchLiveDataSupabase(schemeCode, units) {
  try {
    // 1. Fetch Performance Metrics
    const { data: perfData, error: perfError } = await supabase
      .from('fund_performance')
      .select(`latest_nav, nav_date, ${PERF_COLUMNS.join(', ')}`)
      .eq('scheme_code', schemeCode)
      .single();

    if (perfError || !perfData) return null;

    // 2. Fetch last 2 days of NAV for daily PnL
    const { data: historyData, error: histError } = await supabase
      .from('nav_history')
      .select('nav_value, nav_date')
      .eq('scheme_code', schemeCode)
      .order('nav_date', { ascending: false })
      .limit(2);

    let dailyPnL = null;
    if (!histError && historyData && historyData.length >= 2) {
      const todayNAV = parseFloat(historyData[0].nav_value);
      const yesterdayNAV = parseFloat(historyData[1].nav_value);
      const change = todayNAV - yesterdayNAV;
      const changePct = (change / yesterdayNAV) * 100;
      dailyPnL = {
        change: change * units,
        changePct,
        todayNAV,
        yesterdayNAV
      };
    }

    const returns = {};
    PERF_COLUMNS.forEach(col => {
      returns[col] = perfData[col];
    });

    return {
      nav: parseFloat(perfData.latest_nav),
      navDate: perfData.nav_date,
      returns,
      dailyPnL
    };
  } catch (e) {
    console.error('fetchLiveDataSupabase error:', e);
    return null;
  }
}

/**
 * Get latest NAV for a scheme (used by XIRR/TaxSummary).
 */
export async function getLatestNAV(schemeCode) {
  try {
    const { data, error } = await supabase
      .from('fund_performance')
      .select('latest_nav, nav_date')
      .eq('scheme_code', schemeCode)
      .single();
      
    if (error || !data) return null;
    return {
      nav: parseFloat(data.latest_nav),
      date: data.nav_date
    };
  } catch(e) {
    console.error('getLatestNAV error:', e);
    return null;
  }
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
