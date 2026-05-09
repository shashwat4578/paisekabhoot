import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const SUPABASE_URL = 'https://bmyxlojdiohawlwobtrk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJteXhsb2pkaW9oYXdsd29idHJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzc5NzIsImV4cCI6MjA5MjYxMzk3Mn0.Vf84mJ1iGQlt3cN5VO-6UIodbm6YV8IDvgkCRo6YLm4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { transport: ws } });

async function calculateCAGR(startNav, endNav, days) {
    if (!startNav || !endNav || startNav <= 0 || days <= 0) return null;
    return parseFloat(((Math.pow(endNav / startNav, 365 / days) - 1) * 100).toFixed(2));
}

async function syncMissing() {
    console.log('🔍 Fetching funds with missing performance data...');
    const { data: missing, error } = await supabase
        .from('fund_performance')
        .select('scheme_code')
        .is('return_1y', null)
        .limit(200); 

    if (error) {
        console.error('Error fetching missing funds:', error);
        return;
    }

    console.log(`🚀 Found ${missing.length} missing funds. Syncing from mfapi.in...`);

    for (const fund of missing) {
        const code = fund.scheme_code;
        try {
            const res = await fetch(`https://api.mfapi.in/mf/${code}`);
            const json = await res.json();

            if (json.status !== 'SUCCESS' || !json.data || json.data.length === 0) {
                console.log(`   ⚠️  No history for ${code}`);
                continue;
            }

            const history = json.data;
            const latestNav = parseFloat(history[0].nav);
            const latestDate = new Date(history[0].date.split('-').reverse().join('-'));

            const getNavAgo = (years) => {
                const target = new Date(latestDate);
                target.setFullYear(target.getFullYear() - years);
                // Find closest date on or before target
                const past = history.find(h => {
                    const d = new Date(h.date.split('-').reverse().join('-'));
                    return d <= target;
                });
                if (!past) return null;
                return { nav: parseFloat(past.nav), date: new Date(past.date.split('-').reverse().join('-')) };
            };

            const nav1y = getNavAgo(1);
            const nav3y = getNavAgo(3);
            const nav5y = getNavAgo(5);

            const ret1y = nav1y ? parseFloat(((latestNav / nav1y.nav - 1) * 100).toFixed(2)) : null;
            const ret3y = nav3y ? await calculateCAGR(nav3y.nav, latestNav, (latestDate - nav3y.date) / (1000 * 60 * 60 * 24)) : null;
            const ret5y = nav5y ? await calculateCAGR(nav5y.nav, latestNav, (latestDate - nav5y.date) / (1000 * 60 * 60 * 24)) : null;

            await supabase.from('fund_performance').update({
                latest_nav: latestNav,
                nav_date: latestDate.toISOString().split('T')[0],
                return_1y: ret1y,
                return_3y: ret3y,
                return_5y: ret5y,
                updated_at: new Date().toISOString()
            }).eq('scheme_code', code);

            console.log(`   ✅ Synced ${code}: 1Y=${ret1y}% 3Y=${ret3y}% 5Y=${ret5y}%`);
        } catch (e) {
            console.error(`   ❌ Error syncing ${code}:`, e.message);
        }
        
        await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n✨ Chunk complete.');
}

syncMissing();
