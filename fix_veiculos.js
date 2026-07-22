import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src', 'pages', 'frota', 'FrotaVeiculosPage.tsx');

console.log('Reading FrotaVeiculosPage.tsx...');
const buffer = fs.readFileSync(filePath);

let contentStr = '';
// Detect UTF-16 BOM
if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
  console.log('Detected UTF-16 LE BOM.');
  contentStr = buffer.toString('utf16le');
} else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
  console.log('Detected UTF-16 BE BOM.');
  contentStr = buffer.toString('utf16be');
} else {
  console.log('Reading as standard UTF-8...');
  contentStr = buffer.toString('utf8');
}

// Clean up any remaining null bytes just in case
contentStr = contentStr.replace(/\0/g, '');

console.log('Starting replacements...');

// 1. Define the correct, updated card top block (with dynamic warning borders)
const newCardBlock = `            return (
              <div
                key={v.id}
                className={cn(
                  "border rounded-[2.5rem] p-6 flex flex-col shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all relative overflow-hidden backdrop-blur-md group",
                  isOilOverdue 
                    ? "bg-rose-500/[0.02] border-rose-500/30 hover:border-rose-500/50 shadow-md shadow-rose-500/5"
                    : isOilCritical 
                    ? "bg-amber-500/[0.02] border-amber-500/30 hover:border-amber-500/50 shadow-md shadow-amber-500/5"
                    : v.status === 'ativo' 
                    ? "bg-emerald-500/[0.01] border-emerald-500/15 hover:border-emerald-500/35" 
                    : v.status === 'manutencao' 
                    ? "bg-amber-500/[0.02] border-amber-500/20 hover:border-amber-500/40" 
                    : "bg-rose-500/[0.01] border-rose-500/20 hover:border-rose-500/35"
                )}
              >
                <div className={cn(
                  "absolute top-0 left-0 right-0 h-1.5",
                  isOilOverdue ? "bg-rose-500 animate-pulse shadow-md shadow-rose-500/50" :
                  isOilCritical ? "bg-amber-500 animate-pulse shadow-md shadow-amber-500/50" :
                  v.status === 'ativo' ? "bg-emerald-500/30" : 
                  v.status === 'manutencao' ? "bg-amber-500/30" : "bg-rose-500/30"
                )} />

                {/* Brazilian Mercosul Plate Aesthetics & Status */}
                <div className="flex items-start justify-between mb-4 mt-2">
                  <div className="flex flex-col items-center bg-white border-2 border-zinc-400/80 rounded-lg px-2.5 py-1 shadow-sm min-w-[105px] text-center font-bold tracking-wider relative shrink-0">
                    <div className="absolute top-0 left-0 right-0 h-2 bg-[#002F6C] rounded-t-[5px]" />
                    <span className="text-[6px] text-white font-black z-10 uppercase tracking-widest leading-none mt-[1px]">BRASIL</span>
                    <span className="text-[10px] font-black text-zinc-900 mt-1.5 tracking-widest uppercase">{v.placa}</span>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border leading-none",
                      v.status === 'ativo' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : 
                      v.status === 'manutencao' ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                    )}>
                      {v.status === 'ativo' ? '● Ativo' : v.status === 'manutencao' ? '🔧 Manutenção' : '✕ Inativo'}
                    </span>

                    {isOilOverdue && (
                      <span className="px-2 py-1 bg-rose-500 text-white rounded-lg text-[8px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-md shadow-rose-500/25 border border-rose-600 leading-none">
                        ⚠️ Óleo Vencido
                      </span>
                    )}
                    {!isOilOverdue && isOilCritical && (
                      <span className="px-2 py-1 bg-amber-500 text-white rounded-lg text-[8px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-md shadow-amber-500/25 border border-amber-600 leading-none">
                        ⚠️ Óleo Crítico
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">`;

let hasReplacedCard = false;

let indexStart = contentStr.indexOf('key={v.id}');
if (indexStart !== -1) {
  let blockStart = contentStr.lastIndexOf('return (', indexStart);
  if (blockStart === -1) blockStart = contentStr.lastIndexOf('<div', indexStart);
  
  const blockEnd = contentStr.indexOf('flex items-center gap-3', indexStart);
  if (blockStart !== -1 && blockEnd !== -1) {
    let actualEnd = contentStr.lastIndexOf('<div', blockEnd);
    if (actualEnd !== -1) {
      const beforeStr = contentStr.substring(0, blockStart);
      const afterStr = contentStr.substring(actualEnd);
      contentStr = beforeStr + newCardBlock + '\n' + afterStr;
      console.log('Successfully replaced corrupted card top section!');
      hasReplacedCard = true;
    }
  }
}

if (!hasReplacedCard) {
  console.error('Failed to locate card top section index.');
}

// 2. Insert the prominent warning banner inside the oil tracker section
console.log('Adding oil warning alert banner...');
const targetTrackerStr = `                {/* Mini Odometer Gauge / Oil Change Life Tracker */}
                <div className="mt-4 pt-4 border-t border-border/40">
                  <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">`;

const targetTrackerStrLF = targetTrackerStr.replace(/\r\n/g, '\n');

const newTrackerBlock = `                {/* Mini Odometer Gauge / Oil Change Life Tracker */}
                <div className="mt-4 pt-4 border-t border-border/40">
                  {/* Warning alert banner when oil is critical or overdue */}
                  {(isOilOverdue || isOilCritical) && (
                    <div className={cn(
                      "mb-3 px-3 py-2.5 rounded-2xl border flex items-center gap-2.5 shadow-sm transition-all",
                      isOilOverdue 
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-500 dark:bg-rose-500/5" 
                        : "bg-amber-500/10 border-amber-500/20 text-amber-500 dark:bg-amber-500/5"
                    )}>
                      <Droplet className={cn("w-4 h-4 shrink-0", isOilOverdue ? "animate-bounce" : "animate-pulse")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-wider leading-none">
                          {isOilOverdue ? "Troca de Óleo Vencida!" : "Atenção: Troca de Óleo Próxima"}
                        </p>
                        <p className="text-[8px] font-bold uppercase tracking-widest mt-1 opacity-90">
                          {isOilOverdue 
                            ? \`Vencido há \${Math.abs(kmParaTroca).toLocaleString('pt-BR')} km\` 
                            : \`Faltam apenas \${kmParaTroca.toLocaleString('pt-BR')} km\`}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">`;

let trackerReplaced = false;
if (contentStr.includes(targetTrackerStr)) {
  contentStr = contentStr.replace(targetTrackerStr, newTrackerBlock);
  trackerReplaced = true;
} else if (contentStr.includes(targetTrackerStrLF)) {
  contentStr = contentStr.replace(targetTrackerStrLF, newTrackerBlock);
  trackerReplaced = true;
} else {
  const regexTracker = /\{\/\*\s*Mini Odometer Gauge\s*\/[\s\S]*?mt-4 pt-4 border-t[\s\S]*?mb-1\.5"\s*>/;
  if (regexTracker.test(contentStr)) {
    contentStr = contentStr.replace(regexTracker, newTrackerBlock);
    trackerReplaced = true;
  }
}

if (trackerReplaced) {
  console.log('Successfully inserted oil warning alert banner!');
} else {
  console.error('Failed to locate tracker block to insert warning banner.');
}

console.log('Writing back to FrotaVeiculosPage.tsx in standard UTF-8...');
fs.writeFileSync(filePath, contentStr, 'utf8');
console.log('Successfully written file in UTF-8 format!');
