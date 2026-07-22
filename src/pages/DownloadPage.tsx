import React from 'react'
import { 
  Download, Smartphone, ShieldCheck, AlertCircle, QrCode, Globe, Compass, ArrowLeft
} from 'lucide-react'
import { useConfiguracao } from '../hooks/useConfiguracoes'
import { Button } from '../components/ui/Button'
import { Link } from 'react-router-dom'

export function DownloadPage() {
  const { data: platNome = '7Locar' } = useConfiguracao('plataforma_nome', '7Locar')
  const { data: platSlogan = 'Gestão Eficaz' } = useConfiguracao('plataforma_slogan', 'Gestão Eficaz')

  // Dynamically build the download URL based on current host (local or production)
  // If running locally, we point directly to the production domain so that scanning the screen with a phone triggers the download!
  const downloadUrl = typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')
    ? window.location.origin + '/7locar.apk' 
    : 'https://7locar.7all.com.br/7locar.apk'

  // Generate functional QR Code using a highly reliable, high-speed public API
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(downloadUrl)}`

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-neutral-950 to-black text-white relative overflow-hidden flex flex-col justify-between py-12 px-4 sm:px-6">
      {/* Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between mb-12 relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Login
        </Link>
        <span className="text-[9px] font-black uppercase tracking-[0.3em] bg-primary/15 border border-primary/25 text-primary px-3.5 py-1.5 rounded-full shadow-sm">
          {platNome} Mobile App
        </span>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto w-full relative z-10 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Branding and Direct Download */}
          <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-none uppercase">
                Leve o <span className="bg-gradient-to-r from-primary via-amber-500 to-amber-600 bg-clip-text text-transparent">{platNome}</span> <br className="hidden sm:inline" /> no seu celular
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground font-bold tracking-wide uppercase max-w-xl mx-auto lg:mx-0">
                {platSlogan} — Tenha o controle total da frota, escalas, equipes e rendimento na palma da sua mão com nosso aplicativo nativo WebView.
              </p>
            </div>

            {/* Premium Download Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a 
                href="/7locar.apk" 
                download="7locar.apk"
                className="inline-flex h-14 px-8 rounded-2xl bg-gradient-to-r from-primary to-amber-500 hover:from-primary/95 hover:to-amber-500/95 text-black font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/25 hover:scale-[1.03] active:scale-95 transition-all items-center justify-center gap-3 border border-primary/20 shrink-0 cursor-pointer"
              >
                <Download className="w-5 h-5" /> Baixar APK Direto
              </a>
              
              <div className="inline-flex items-center justify-center gap-2.5 px-5 py-3.5 bg-card/45 dark:bg-card/20 backdrop-blur-md border border-border/40 rounded-2xl">
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-wider leading-none text-emerald-400">Verificado Seguro</p>
                  <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Livre de vírus e malwares</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-center lg:justify-start text-muted-foreground/75">
              <AlertCircle className="w-4.5 h-4.5 text-primary shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-wider leading-relaxed max-w-sm">
                Nota: O aplicativo WebView foi configurado especialmente para operar a partir do domínio oficial <span className="text-primary font-black">7locar.7all.com.br</span>.
              </p>
            </div>
          </div>

          {/* Right Column: QR Code & Premium Mockup */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="relative p-7 bg-gradient-to-b from-card/85 via-card/75 to-card/50 backdrop-blur-2xl border border-border/40 rounded-[2.5rem] shadow-2xl w-full max-w-[340px] overflow-hidden group">
              <div className="absolute top-0 right-0 w-28 h-28 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
              
              {/* Scan effect */}
              <div className="absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60 animate-bounce pointer-events-none" />

              <div className="space-y-6 text-center">
                <div className="w-48 h-48 bg-white rounded-3xl p-5 mx-auto flex items-center justify-center shadow-inner relative group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden">
                  <img 
                    src={qrCodeUrl} 
                    alt="Scanear QR Code" 
                    className="w-full h-full object-contain select-none" 
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Aponte a Câmera</h3>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider max-w-xs mx-auto">
                    Escaneie o QR Code acima para baixar o aplicativo diretamente no seu celular Android.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Installation Steps Section */}
        <div className="mt-20 border-t border-border/30 pt-16">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider">Como Instalar no Android</h2>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mt-2">Siga o passo a passo simples de 3 etapas</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-card/45 dark:bg-card/25 backdrop-blur-lg border border-border/35 rounded-3xl p-6 relative overflow-hidden group">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 font-black text-primary text-sm shadow-inner">
                1
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider mb-2">Baixar APK</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-relaxed">
                Clique no botão de download acima ou escaneie o QR Code para transferir o arquivo <span className="text-primary">7locar.apk</span>.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-card/45 dark:bg-card/25 backdrop-blur-lg border border-border/35 rounded-3xl p-6 relative overflow-hidden group">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 font-black text-primary text-sm shadow-inner">
                2
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider mb-2">Autorizar Instalação</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-relaxed">
                Ao abrir o arquivo, se solicitado pelo sistema do Android, ative a opção "Permitir desta fonte" nas configurações de segurança do navegador.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-card/45 dark:bg-card/25 backdrop-blur-lg border border-border/35 rounded-3xl p-6 relative overflow-hidden group">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 font-black text-primary text-sm shadow-inner">
                3
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider mb-2">Iniciar Sessão</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-relaxed">
                Abra o aplicativo, que carregará de forma limpa e nativa todo o sistema do <span className="text-primary">7locar.7all.com.br</span>, e entre com suas credenciais de acesso.
              </p>
            </div>
          </div>
        </div>

        {/* PWA Section */}
        <div className="mt-16 bg-gradient-to-r from-primary/10 via-amber-500/5 to-transparent border border-primary/20 rounded-[2.5rem] p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 text-center md:text-left">
            <span className="text-[8.5px] font-black uppercase tracking-[0.25em] bg-primary/15 border border-primary/20 text-primary px-3 py-1 rounded-full shadow-inner">
              Método Alternativo PWA
            </span>
            <h3 className="text-sm sm:text-base font-black uppercase tracking-wider">Instalação Instantânea Sem Download</h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide leading-relaxed max-w-xl">
              Você também pode instalar diretamente pelo navegador! Acesse <span className="text-primary font-black">7locar.7all.com.br</span> no Google Chrome (Android) ou Safari (iOS) e clique em <strong>"Adicionar à Tela de Início"</strong> no menu do navegador para ter a mesma experiência nativa de app.
            </p>
          </div>
          <div className="flex gap-4.5 shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-md">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <span className="text-[8px] font-black uppercase text-muted-foreground/60 mt-1">Chrome</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-md">
                <Compass className="w-6 h-6 text-sky-400" />
              </div>
              <span className="text-[8px] font-black uppercase text-muted-foreground/60 mt-1">Safari</span>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="max-w-4xl mx-auto w-full mt-16 pt-6 border-t border-border/20 text-center relative z-10">
        <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">
          © {new Date().getFullYear()} {platNome}. Todos os direitos reservados.
        </p>
      </div>

    </div>
  )
}
