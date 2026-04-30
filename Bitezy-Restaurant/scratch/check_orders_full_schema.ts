import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tcqkoknzhjbpqdqypczb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjcWtva256aGpicHFkcXlwY3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODg5MzYsImV4cCI6MjA5MDE2NDkzNn0.QqHiFKOzMAnC2_0I_wL_4wZpUJwtLRIUUWi4m403QSs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkOrdersSchema() {
  const { data: order, error } = await supabase.from('orders').select('*').limit(1).single();
  if (order) console.log('Orders Schema Keys:', Object.keys(order));
  if (error) console.error('Error:', error);
}

checkOrdersSchema();
