import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws';
global.WebSocket = WebSocket;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bmyxlojdiohawlwobtrk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verify() {
  const { count: fpCount } = await supabase.from('fund_performance').select('*', { count: 'exact', head: true });
  const { count: mfCount } = await supabase.from('mutual_funds').select('*', { count: 'exact', head: true });
  console.log("Total rows in fund_performance:", fpCount);
  console.log("Total rows in mutual_funds:", mfCount);
}

verify();
