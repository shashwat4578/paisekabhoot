import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws';
global.WebSocket = WebSocket;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTables() {
    console.log("Checking tables...");
    
    const tables = ['mutual_funds', 'nav_history', 'fund_performance', 'user_portfolios'];
    
    for (const table of tables) {
        const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) {
            console.log(`- ${table}: FAILED (${error.message})`);
        } else {
            console.log(`- ${table}: SUCCESS`);
        }
    }
}

checkTables();
