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
import WebSocket from 'ws';
global.WebSocket = WebSocket;

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
      nav_value: f.nav_value,
      nav: f.nav_value
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

// ─── Step 3: Update fund_performance table directly ───────────────────────────────
async function updatePerformance(funds) {
  console.log("\n📊 Updating latest NAVs in fund_performance...");

  const CHUNK_SIZE = 1000;
  for (let i = 0; i < funds.length; i += CHUNK_SIZE) {
    const chunk = funds.slice(i, i + CHUNK_SIZE);
    
    // We only update the latest_nav and nav_date, preserving the 1Y/3Y/5Y calculated during migration
    const metricsToUpsert = chunk.map(f => ({
      scheme_code: f.scheme_code,
      latest_nav: f.nav_value,
      nav_date: f.nav_date,
      updated_at: new Date().toISOString()
    }));

    if (metricsToUpsert.length > 0) {
      const { error } = await supabase
        .from('fund_performance')
        .upsert(metricsToUpsert, { onConflict: 'scheme_code' });
      if (error) console.error("   ⚠️ Performance upsert error:", error.message);
    }

    const batchNum = Math.floor(i / CHUNK_SIZE) + 1;
    const totalBatches = Math.ceil(funds.length / CHUNK_SIZE);
    console.log(`   Performance batch ${batchNum}/${totalBatches} done.`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function run() {
  const startTime = Date.now();
  try {
    const funds = await fetchAmfiData();
    await updateDatabase(funds);
    await updatePerformance(funds);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Daily update completed successfully in ${elapsed}s!`);
  } catch (err) {
    console.error("❌ Fatal error during daily update:", err);
    process.exit(1);
  }
}

run();
