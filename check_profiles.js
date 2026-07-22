const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, nome, cpf, senha, ativo')
    .limit(10);
    
  if (error) {
    console.error("Error fetching profiles:", error);
  } else {
    console.log("Profiles found:", JSON.stringify(profiles, null, 2));
  }
}

checkProfiles();
