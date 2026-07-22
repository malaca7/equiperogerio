const url = 'https://mrzyueskzxgmcfilobrj.supabase.co/rest/v1/profiles?cpf=eq.09924553403&senha=eq.199425&limit=1';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yenl1ZXNrenhnbWNmaWxvYnJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTQ0NDgsImV4cCI6MjA5Mjk3MDQ0OH0.hr-8Va4QlFwveJYWcd8dcDMybBjy247ZKZneNGPTblA';

async function testLogin() {
  const res = await fetch(url, {
    headers: {
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`
    }
  });
  const data = await res.json();
  console.log('Login Query Result:', data);
}

testLogin();
