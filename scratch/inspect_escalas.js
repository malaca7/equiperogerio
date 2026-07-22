const url = 'https://mrzyueskzxgmcfilobrj.supabase.co/rest/v1/escalas?data=gte.2026-06-12&data=lte.2026-06-16&select=*,funcionarios(nome)';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yenl1ZXNrenhnbWNmaWxvYnJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTQ0NDgsImV4cCI6MjA5Mjk3MDQ0OH0.hr-8Va4QlFwveJYWcd8dcDMybBjy247ZKZneNGPTblA';

fetch(url, {
  headers: {
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`
  }
})
  .then(res => res.json())
  .then(data => {
    console.log('Scales from June 12 to 16, 2026:');
    data.forEach(e => {
      console.log(`ID: ${e.id}, Func: ${e.funcionarios?.nome}, Date: ${e.data}, Type: ${e.tipo}`);
    });
    console.log('Total records:', data.length);
  })
  .catch(err => console.error(err));
