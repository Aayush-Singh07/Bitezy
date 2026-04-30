import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tcqkoknzhjbpqdqypczb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjcWtva256aGpicHFkcXlwY3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1ODg5MzYsImV4cCI6MjA5MDE2NDkzNn0.QqHiFKOzMAnC2_0I_wL_4wZpUJwtLRIUUWi4m403QSs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUsersSchema() {
  const { data: user, error } = await supabase.from('users').select('*').limit(1).single();
  if (user) console.log('Users Schema Keys:', Object.keys(user));
  if (error) console.error('Error:', error);
}

checkUsersSchema();
