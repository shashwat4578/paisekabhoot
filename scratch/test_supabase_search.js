import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const supabaseUrl = 'https://bmyxlojdiohawlwobtrk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJteXhsb2pkaW9oYXdsd29idHJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzc5NzIsImV4cCI6MjA5MjYxMzk3Mn0.Vf84mJ1iGQlt3cN5VO-6UIodbm6YV8IDvgkCRo6YLm4';

// Node 20 WebSocket polyfill
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    transport: WebSocket
  }
});

async function testSearch() {
  const query = 'Franklin India Large Cap Fund';
  console.log(`Testing search for: ${query}`);
  
  const { data, error } = await supabase
    .from('mutual_funds')
    .select(`
      scheme_code, 
      scheme_name,
      fund_performance (
        latest_nav,
        return_1y,
        return_3y,
        return_5y
      )
    `)
    .ilike('scheme_name', `%${query}%`)
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Results:');
  console.log(JSON.stringify(data, null, 2));
}

testSearch();
