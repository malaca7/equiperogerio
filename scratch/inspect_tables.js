const { createClient } = require('@supabase/supabase-client');

const supabaseUrl = 'https://mrzyueskzxgmcfilobrj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yenl1ZXNrenhnbWNmaWxvYnJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTQ0NDgsImV4cCI6MjA5Mjk3MDQ0OH0.hr-8Va4QlFwveJYWcd8dcDMybBjy247ZKZneNGPTblA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('equipes').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log('Equipes row keys:', Object.keys(data[0] || {}));
  }
}
run();
