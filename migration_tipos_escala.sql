-- 1. Remover a restrição fixa dos tipos de escala para permitir customização
ALTER TABLE public.escalas DROP CONSTRAINT IF EXISTS escalas_tipo_check;

-- 2. Inserir os tipos de escala padrão na tabela de configurações
INSERT INTO public.configuracoes (chave, valor) VALUES
  ('tipos_escala', '[
    {"id":"presente","letra":"T","nome":"Trabalho","bg":"bg-blue-500","text":"text-white","ring":"ring-blue-400"},
    {"id":"repouso","letra":"R","nome":"Repouso","bg":"bg-amber-400","text":"text-amber-900","ring":"ring-amber-300"},
    {"id":"compensar","letra":"F","nome":"Folga","bg":"bg-emerald-500","text":"text-white","ring":"ring-emerald-400"},
    {"id":"ferias","letra":"FE","nome":"Férias","bg":"bg-purple-500","text":"text-white","ring":"ring-purple-400"},
    {"id":"atestado","letra":"A","nome":"Afastamento","bg":"bg-red-500","text":"text-white","ring":"ring-red-400"},
    {"id":"falta","letra":"X","nome":"Falta","bg":"bg-rose-600","text":"text-white","ring":"ring-rose-500"},
    {"id":"falta_justificada","letra":"J","nome":"F. Justificada","bg":"bg-orange-500","text":"text-white","ring":"ring-orange-400"},
    {"id":"suspensao","letra":"S","nome":"Suspensão","bg":"bg-rose-800","text":"text-white","ring":"ring-rose-700"},
    {"id":"paternidade","letra":"P","nome":"Paternidade","bg":"bg-sky-500","text":"text-white","ring":"ring-sky-400"},
    {"id":"obito_familiar","letra":"O","nome":"Óbito","bg":"bg-slate-700","text":"text-white","ring":"ring-slate-600"},
    {"id":"beneficio","letra":"B","nome":"Benefício","bg":"bg-violet-500","text":"text-white","ring":"ring-violet-400"},
    {"id":"transferencia","letra":"TR","nome":"Transferência","bg":"bg-gray-500","text":"text-white","ring":"ring-gray-400"}
  ]'::jsonb)
ON CONFLICT (chave) DO NOTHING;
