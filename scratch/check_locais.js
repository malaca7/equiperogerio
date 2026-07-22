import fetch from 'node-fetch'; // wait, node-fetch might not be installed, we can use built-in fetch on modern Node versions
const url = 'https://mrzyueskzxgmcfilobrj.supabase.co/rest/v1/configuracoes?chave=like.equipes_meta_%';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yenl1ZXNrenhnbWNmaWxvYnJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTQ0NDgsImV4cCI6MjA5Mjk3MDQ0OH0.hr-8Va4QlFwveJYWcd8dcDMybBjy247ZKZneNGPTblA';

fetch(url, {
  headers: {
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`
  }
})
  .then(res => res.json())
  .then(data => {
    console.log('Total keys starting with equipes_meta_:', data.length);
    const allLocais = new Set();
    data.forEach(row => {
      const meta = row.valor || {};
      Object.values(meta).forEach(teamMeta => {
        if (teamMeta && Array.isArray(teamMeta.locais)) {
          teamMeta.locais.forEach(local => {
            if (local && typeof local === 'string') {
              allLocais.add(local.trim());
            }
          });
        }
      });
    });
    console.log('Unique locations found:', Array.from(allLocais));
  })
  .catch(err => console.error(err));
