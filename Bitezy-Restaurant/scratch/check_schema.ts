import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tcqkoknzhjbpqdqypczb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjcWtva256aGpicHFkcXlwY3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODg5MzYsImV4cCI6MjA5MDE2NDkzNn0.QqHiFKOzMAnC2_0I_wL_4wZpUJwtLRIUUWi4m403QSs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  const { data: item, error: itemError } = await supabase.from('items').select('*').limit(1).single();
  const { data: combo, error: comboError } = await supabase.from('combos').select('*').limit(1).single();

  if (item) console.log('Item Schema Keys:', Object.keys(item));
  if (combo) console.log('Combo Schema Keys:', Object.keys(combo));
  
  if (itemError) console.error('Item Error:', itemError);
  if (comboError) console.error('Combo Error:', comboError);
}

checkSchema();
