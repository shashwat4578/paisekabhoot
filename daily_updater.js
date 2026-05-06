/**
 * daily_updater.js — Runs every night via GitHub Actions cron job.
 *
 * What it does:
 *   1. Fetches today's NAV data from AMFI (https://www.amfiindia.com/spages/NAVAll.txt)
 *   2. Upserts fund details into `mutual_funds` table
 *   3. Inserts today's NAV into `nav_history` table  
 *   4. Recalculates 1Y/3Y/5Y performance using the `nav_history` data
 *   5. Updates the `fund_performance` table so the frontend always shows fresh metrics
 *
 * Cron schedule: 0 18 * * * (UTC) = 11:30 PM IST
 *   AMFI typically publishes NAVs by 10-11 PM IST on business days.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bmyxlojdiohawlwobtrk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_KEY) {
  console.error("❌ FATAL: SUPABASE_KEY environment variable is not set.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const AMFI_URL = 'https://www.amfiindia.com/spages/NAVAll.txt';
const CHUNK_SIZE = 1000;

// ─── Helper: Parse AMFI date "06-May-2026" → "2026-05-06" ───────────────────
function parseAmfiDate(dateStr) {
  if (!dateStr) return null;
  const months = {
    'Jan':'01','Feb':'02','Mar':'03','Apr':'04','May':'05','Jun':'06',
    'Jul':'07','Aug':'08','Sep':'09','Oct':'10','Nov':'11','Dec':'12'
  };
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return null;
  const month = months[parts[1]];
  if (!month) return null;
  return `${parts[2]}-${month}-${parts[0].padStart(2, '0')}`;
}

// ─── Step 1: Fetch & parse the AMFI text file ───────────────────────────────
async function fetchAmfiData() {
  console.log("📡 Fetching latest NAV data from AMFI...");
  const response = await fetch(AMFI_URL);
  const text = await response.text();
  const lines = text.split('\n');
  const funds = [];

  for (const line of lines) {
    if (!line.trim() || !line.includes(';')) continue;

    // Format: SchemeCode;ISIN_Payout;ISIN_Reinvest;SchemeName;NAV;Date
    const parts = line.split(';');
    if (parts.length < 6) continue;

    const schemeCode = parseInt(parts[0], 10);
    if (isNaN(schemeCode)) continue;

    const nav = parseFloat(parts[4]);
    if (isNaN(nav) || nav <= 0) continue;

    const navDate = parseAmfiDate(parts[5]);
    if (!navDate) continue;

    funds.push({
      scheme_code: schemeCode,
      isin: parts[1].trim() || parts[2].trim(),
      scheme_name: parts[3].trim(),
      nav_value: nav,
      nav_date: navDate
    });
  }

  console.log(`   ✅ Parsed ${funds.length} funds from AMFI.`);
  return funds;
}

// ─── Step 2: Upsert fund details + today's NAV into Supabase ─────────────────
async function updateDatabase(funds) {
  console.log("\n📤 Uploading fund details and NAV history to Supabase...");

  for (let i = 0; i < funds.length; i += CHUNK_SIZE) {
    const chunk = funds.slice(i, i + CHUNK_SIZE);

    // Upsert mutual_funds (static info)
    const fundDetails = chunk.map(f => ({
      scheme_code: f.scheme_code,
      isin: f.isin,
      scheme_name: f.scheme_name
    }));

    const { error: fundErr } = await supabase
      .from('mutual_funds')
      .upsert(fundDetails, { onConflict: 'scheme_code', ignoreDuplicates: true });
    if (fundErr) console.error("   ⚠️ mutual_funds error:", fundErr.message);

    // Upsert nav_history (today's NAV)
    const navRows = chunk.map(f => ({
      scheme_code: f.scheme_code,
      nav_date: f.nav_date,
      nav_value: f.nav_value
    }));

    const { error: navErr } = await supabase
      .from('nav_history')
      .upsert(navRows, { onConflict: 'scheme_code, nav_date', ignoreDuplicates: true });
    if (navErr) console.error("   ⚠️ nav_history error:", navErr.message);

    const batchNum = Math.floor(i / CHUNK_SIZE) + 1;
    const totalBatches = Math.ceil(funds.length / CHUNK_SIZE);
    console.log(`   Batch ${batchNum}/${totalBatches} uploaded.`);
  }
}

// ─── Step 3: Recalculate 1Y/3Y/5Y performance ───────────────────────────────
async function calculatePerformance() {
  console.log("\n📊 Recalculating 1Y, 3Y, 5Y performance...");

  // Get all scheme codes
  const { data: allFunds, error: fetchErr } = await supabase
    .from('mutual_funds')
    .select('scheme_code');

  if (fetchErr || !allFunds) {
    console.error("   ❌ Could not fetch funds:", fetchErr?.message);
    return;
  }

  console.log(`   Processing ${allFunds.length} funds...`);

  for (let i = 0; i < allFunds.length; i += CHUNK_SIZE) {
    const chunk = allFunds.slice(i, i + CHUNK_SIZE);
    const metricsToUpsert = [];

    for (const fund of chunk) {
      // Fetch NAV history for this fund (most recent first)
      const { data: history } = await supabase
        .from('nav_history')
        .select('nav_value, nav_date')
        .eq('scheme_code', fund.scheme_code)
        .order('nav_date', { ascending: false })
        .limit(1500); // ~5 years of trading days

      if (!history || history.length === 0) continue;

      const latest = history[0];
      const latestDate = new Date(latest.nav_date);

      // Find NAV closest to N years ago
      const getNavYearsAgo = (years) => {
        const target = new Date(latestDate);
        target.setFullYear(target.getFullYear() - years);

        let closest = null;
        let minDiff = Infinity;

        for (const rec of history) {
          const recDate = new Date(rec.nav_date);
          if (recDate > target) continue; // must be on or before target
          const diff = Math.abs(recDate - target);
          if (diff < minDiff) {
            minDiff = diff;
            closest = rec.nav_value;
          }
        }
        return closest;
      };

      const nav1y = getNavYearsAgo(1);
      const nav3y = getNavYearsAgo(3);
      const nav5y = getNavYearsAgo(5);

      // 1Y = simple %, 3Y/5Y = CAGR
      const ret1y = nav1y ? parseFloat((((latest.nav_value / nav1y) - 1) * 100).toFixed(2)) : null;
      const ret3y = nav3y ? parseFloat(((Math.pow(latest.nav_value / nav3y, 1/3) - 1) * 100).toFixed(2)) : null;
      const ret5y = nav5y ? parseFloat(((Math.pow(latest.nav_value / nav5y, 1/5) - 1) * 100).toFixed(2)) : null;

      metricsToUpsert.push({
        scheme_code: fund.scheme_code,
        latest_nav: latest.nav_value,
        nav_date: latest.nav_date,
        return_1y: ret1y,
        return_3y: ret3y,
        return_5y: ret5y,
        updated_at: new Date().toISOString()
      });
    }

    // Upsert this batch of metrics
    if (metricsToUpsert.length > 0) {
      const { error } = await supabase
        .from('fund_performance')
        .upsert(metricsToUpsert, { onConflict: 'scheme_code' });
      if (error) console.error("   ⚠️ Performance upsert error:", error.message);
    }

    const batchNum = Math.floor(i / CHUNK_SIZE) + 1;
    const totalBatches = Math.ceil(allFunds.length / CHUNK_SIZE);
    console.log(`   Performance batch ${batchNum}/${totalBatches} done.`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function run() {
  const startTime = Date.now();
  try {
    const funds = await fetchAmfiData();
    await updateDatabase(funds);
    await calculatePerformance();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Daily update completed successfully in ${elapsed}s!`);
  } catch (err) {
    console.error("❌ Fatal error during daily update:", err);
    process.exit(1);
  }
}

run();
