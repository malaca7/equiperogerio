const url = 'https://mrzyueskzxgmcfilobrj.supabase.co/rest/v1/funcionarios';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yenl1ZXNrenhnbWNmaWxvYnJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTQ0NDgsImV4cCI6MjA5Mjk3MDQ0OH0.hr-8Va4QlFwveJYWcd8dcDMybBjy247ZKZneNGPTblA';

const nomes = [
  "ANA PAULA SILVA CASSIANO",
  "ANDRÉ PAULO DA SILVA",
  "ANTÔNIA MARIA DOS SANTOS",
  "ARLINDO CAITANO DA SILVA",
  "CARLOS ALEXANDRE CARVALHO",
  "CICERA PEREIRA DA SILVA",
  "CONCEIÇÃO MARIA SANTIAGO",
  "DAMIÃO JOSÉ DE OLIVEIRA",
  "DANIEL BARROS DA SILVA",
  "DELZIANE GOMES DAMASCENO",
  "DULCINEIA JOSEFA NUNES",
  "EDMAR BARBOSA PINTO",
  "EDMILSON JOSÉ DA SILVA",
  "EDNALDO DE JESUS LINDOSO",
  "ERINALDO JOSÉ DE PAULA",
  "WELLINGTON BATISTA DA SILVA",
  "CLAUDEMIR VICENTE DA SILVA",
  "GENILDA BARBOSA DA SILVA",
  "GENILDO JOSÉ DA SILVA",
  "GISSLENO LIRA MACEDO FILHO",
  "SVANETE DIAS DE OLIVEIRA",
  "JANAINA MARIA DA SILVA",
  "JEREMIAS BRITO DE FIGUEREDO",
  "JOEL BARRETO DA SILVA",
  "JOSÉ ANTÔNIO DA SILVA",
  "JOSÉ BELO DA SILVA",
  "JOSE ERIVALDO PAULINO",
  "JOSÉ WELLINGTON DA SILVA",
  "ADJANE MARIA DA SILVA SANTOS",
  "EANDRA DA SILVA CAVALCANTE",
  "MARCONES BATISTA DA SILVA",
  "MARIA BARBOSA DA SILVA",
  "MARIA BEZERRA DA SILVA",
  "MARIA DE FATIMA DA SILVA",
  "MARIA JOSE VIEIRA DE SOUZA",
  "MARIA LUCINEIDE ROQUE DA SILVA",
  "MARIA MADALENA DOS SANTOS",
  "ROSANGELA REGIS DE OLIVEIRA",
  "SILVANA MARIA DA SILVA",
  "ADRIANO NAZARENO FERREIRA",
  "CLAUDENILSON CLAUDIO BANDEIRA",
  "COSMO JOSE NUNES",
  "CRISTINA MARIA FEITOSA TEMUDO",
  "EDILENE GENILDA DE SOUZA",
  "ELIAS FERREIRA LINS",
  "ELIZANGELA MARIA DA SILVA",
  "EVERALDO JERONIMO DOS SANTOS",
  "EZEQUIEL PEREIRA DOS SANTOS",
  "GENIVALDO JOSÉ DA SILVA",
  "IONA FELICIANO DA SILVA",
  "ISRAEL FRANCISCO DA SILVA",
  "IVANILDO CABRAL DE LIMA",
  "JOAO AMARO DA SILVA",
  "JOSE ROBERTO DA SILVA",
  "LUCAS JUNIOR DA SILVA",
  "MANOEL SILVA DE BARROS",
  "MANUEL MESSIAS DA SILVA",
  "MURILO FRANCISCO DA SILVA",
  "OZEAS COSTA GOMES",
  "SEVERINO TAVARES DA SILVA",
  "SILVANA NATALI LIMA DO NASCIMENTO",
  "SILVANIA MARIA DA SILVA"
];

const payload = nomes.map(nome => ({
  nome,
  matricula: '',
  cargo: 'Agente de limpeza',
  setor: 'Varrição',
  status: 'ativo'
}));

async function run() {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Error inserting:', res.status, errText);
    } else {
      const data = await res.json();
      console.log(`Successfully inserted ${data.length} funcionarios!`);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

run();
