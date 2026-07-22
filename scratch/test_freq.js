const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Environment variables not loaded from .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Testing frequency upsert...');
  try {
    const { data, error } = await supabase
      .from('frequencia')
      .upsert({
        funcionario_id: 'd9b736b0-ecb0-4ef1-be0b-b1834927cbcd', // Dummy UUID or real one
        data: '2026-07-08',
        status: 'presente',
        updated_at: new Date().toISOString()
      }, { onConflict: 'funcionario_id,data' })
      .select();
      
    if (error) {
      console.error('Error during upsert:', error);
    } else {
      console.log('Upsert succeeded! Returned data:', data);
    }
  } catch (err) {
    console.error('Catastrophic failure:', err);
  }
}

run();
