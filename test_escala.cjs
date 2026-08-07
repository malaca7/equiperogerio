const fs = require('fs');
const content = fs.readFileSync('src/pages/EscalaLocalidadePage.tsx', 'utf-8');
const match = content.match(/availableFuncs = useMemo\(\(\) => \{([\s\S]*?)\}, \[filteredFuncionarios/);
console.log(match ? match[1] : 'not found');
