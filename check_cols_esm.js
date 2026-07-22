import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { data, error } = await supabase
      .from('funcionarios')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error fetching:', error);
    } else {
      console.log('KEYS:', Object.keys(data[0] || {}));
    }
  } catch (err) {
    console.error(err);
  }
}
run();
