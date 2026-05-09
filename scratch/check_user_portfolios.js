import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws';
global.WebSocket = WebSocket;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkStructure() {
    console.log("Checking user_portfolios structure...");
    const { data, error } = await supabase.from('user_portfolios').select('*').limit(1);
    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Sample data:", JSON.stringify(data, null, 2));
    }
}

checkStructure();
