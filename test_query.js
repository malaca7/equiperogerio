const url = 'https://mrzyueskzxgmcfilobrj.supabase.co/rest/v1/escalas?data=eq.2026-05-31';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yenl1ZXNrenhnbWNmaWxvYnJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTQ0NDgsImV4cCI6MjA5Mjk3MDQ0OH0.hr-8Va4QlFwveJYWcd8dcDMybBjy247ZKZneNGPTblA';

fetch(url, {
  headers: {
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`
  }
})
  .then(res => res.json())
  .then(data => {
    console.log('Scales on May 31, 2026:', JSON.stringify(data, null, 2));
    console.log('Total records:', data.length);
    console.log('Working (presente/hora_extra):', data.filter(e => e.tipo === 'presente' || e.tipo === 'hora_extra').length);
    console.log('Off (repouso):', data.filter(e => e.tipo === 'repouso').length);
  })
  .catch(err => console.error(err));
