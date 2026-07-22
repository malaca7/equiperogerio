import React, { useState, useEffect } from 'react'
import { Eye, EyeOff, Lock, ArrowRight, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import { cn } from '../lib/utils'
import { useConfiguracao } from '../hooks/useConfiguracoes'

function formatCPF(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0,3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`
}

export function LoginPage() {
  const { signIn } = useAuth()
  const { toast } = useToast()
  const { data: plataformaNome = '7Locar' } = useConfiguracao('plataforma_nome', '7Locar')
  const { data: plataformaSlogan = 'GEstao Eficaz' } = useConfiguracao('plataforma_slogan', 'GEstao Eficaz')
  const { data: plataformaLogoUrl = '' } = useConfiguracao('plataforma_logo_url', '')
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lembrarCpf, setLembrarCpf] = useState(false)

  useEffect(() => {
    const salvoCpf = localStorage.getItem('7boss_lembrar_cpf')
    const salvoSenha = localStorage.getItem('7boss_lembrar_senha')
    if (salvoCpf) {
      setCpf(formatCPF(salvoCpf))
      setLembrarCpf(true)
    }
    if (salvoSenha) {
      setSenha(salvoSenha)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanCpf = cpf.replace(/\D/g, '')
    if (!cleanCpf || !senha) { toast('Preencha CPF e senha', 'warning'); return }
    if (cleanCpf.length < 11) { toast('CPF inválido', 'warning'); return }
    if (lembrarCpf) {
      localStorage.setItem('7boss_lembrar_cpf', cleanCpf)
      localStorage.setItem('7boss_lembrar_senha', senha)
    } else {
      localStorage.removeItem('7boss_lembrar_cpf')
      localStorage.removeItem('7boss_lembrar_senha')
    }
    setLoading(true)
    const { error } = await signIn(cleanCpf, senha)
    setLoading(false)
    if (error) toast(error, 'error')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden bg-background font-sans selection:bg-primary/20">
      
      {/* Premium Minimalist Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full bg-primary/5 blur-[120px] animate-float pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-blue-500/5 blur-[100px] animate-float pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="relative w-full max-w-[420px] z-10 animate-scale-in">
        
        {/* Brand Header */}
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-primary/20 backdrop-blur-md overflow-hidden">
            {plataformaLogoUrl ? (
              <img src={plataformaLogoUrl} alt={plataformaNome} className="w-full h-full object-cover" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-primary" />
            )}
          </div>
          <h1 className="text-4.5xl font-black tracking-tight text-foreground mb-1.5 flex items-center justify-center gap-2">
            {plataformaNome}
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60">
            {plataformaSlogan}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-card/70 dark:bg-card/30 backdrop-blur-3xl border border-border/50 rounded-[2.5rem] shadow-2xl overflow-hidden relative">
          
          {/* Subtle Glow Line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          <div className="p-8 sm:p-10">
            <div className="mb-8 text-center">
              <h2 className="text-lg font-black text-foreground tracking-tight">Autenticação</h2>
              <p className="text-xs font-semibold text-muted-foreground mt-1.5">Insira suas credenciais corporativas</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              
              {/* CPF Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 ml-1">Documento (CPF)</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center justify-center pointer-events-none">
                    <User className="w-4.5 h-4.5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                  </div>
                  <input
                    id="login-cpf"
                    type="text"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={e => setCpf(formatCPF(e.target.value))}
                    className="w-full pl-12 pr-4 py-4 bg-muted/40 border border-border/50 focus:border-primary/50 focus:bg-background rounded-2xl text-sm font-bold text-foreground placeholder:text-muted-foreground/40 outline-none transition-all shadow-sm focus:shadow-md"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1 pr-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Senha de Acesso</label>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center justify-center pointer-events-none">
                    <Lock className="w-4.5 h-4.5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                  </div>
                  <input
                    id="login-senha"
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    autoComplete="current-password"
                    className="w-full pl-12 pr-12 py-4 bg-muted/40 border border-border/50 focus:border-primary/50 focus:bg-background rounded-2xl text-sm font-bold text-foreground placeholder:text-muted-foreground/40 outline-none transition-all shadow-sm focus:shadow-md tracking-[0.2em]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute inset-y-0 right-4 flex items-center justify-center text-muted-foreground/50 hover:text-foreground transition-colors outline-none"
                  >
                    {showPass ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              {/* Save Credentials Checkbox */}
              <label className="flex items-center gap-3 cursor-pointer group pt-1 select-none w-fit ml-1">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={lembrarCpf}
                    onChange={e => setLembrarCpf(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-4.5 h-4.5 rounded-md border-2 border-muted-foreground/30 peer-checked:border-primary peer-checked:bg-primary transition-all group-hover:border-primary/50" />
                  <svg className="absolute w-3 h-3 text-white scale-0 transition-transform peer-checked:scale-100 pointer-events-none" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                  Lembrar minhas credenciais
                </span>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full h-14 mt-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all relative overflow-hidden flex items-center justify-center gap-3 group",
                  loading 
                    ? "bg-primary/50 text-white cursor-not-allowed" 
                    : "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98]"
                )}
              >
                <span className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                
                {loading ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <span>Acessar Plataforma</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
            Acesso Restrito &bull; Uso Corporativo
          </p>
          <p className="text-[9px] font-semibold text-muted-foreground/30 uppercase tracking-[0.2em]">
            &copy; {new Date().getFullYear()} {plataformaNome} System
          </p>
        </div>
      </div>
    </div>
  )
}
