const url = 'https://mrzyueskzxgmcfilobrj.supabase.co/rest/v1/login_logs?select=*&order=tentativa_em.desc&limit=15';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yenl1ZXNrenhnbWNmaWxvYnJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTQ0NDgsImV4cCI6MjA5Mjk3MDQ0OH0.hr-8Va4QlFwveJYWcd8dcDMybBjy247ZKZneNGPTblA';

async function main() {
  const res = await fetch(url, {
    headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
  });
  const data = await res.json();
  console.log('RECENT LOGIN LOGS:', JSON.stringify(data, null, 2));
}

main();
