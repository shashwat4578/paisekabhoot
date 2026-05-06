import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws';
global.WebSocket = WebSocket;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bmyxlojdiohawlwobtrk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verify() {
  const { data, error } = await supabase
    .from('fund_performance')
    .select('scheme_code, latest_nav, nav_date, return_1y, mutual_funds(scheme_name)')
    .order('nav_date', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Top 5 latest updated funds in Supabase:");
    data.forEach(fund => {
      console.log(`- ${fund.mutual_funds.scheme_name}`);
      console.log(`  Date: ${fund.nav_date} | NAV: ${fund.latest_nav} | 1Y Return: ${fund.return_1y}%`);
    });
  }
}

verify();
