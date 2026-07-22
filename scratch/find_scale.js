const fs = require('fs');
const content = fs.readFileSync('d:\\dev\\web\\gestaoequiperogerio\\src\\pages\\EscalaPage.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('scaleStyles')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
