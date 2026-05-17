import React, { useState } from 'react'
import { Eye, EyeOff, Shield, Lock, ArrowRight, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'

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
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanCpf = cpf.replace(/\D/g, '')
    if (!cleanCpf || !senha) {
      toast('Preencha CPF e senha', 'warning')
      return
    }
    if (cleanCpf.length < 11) {
      toast('CPF inválido', 'warning')
      return
    }
    setLoading(true)
    const { error } = await signIn(cleanCpf, senha)
    setLoading(false)
    if (error) toast(error, 'error')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-emerald-600/10 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative w-full max-w-sm z-10">
        <div className="flex flex-col items-center mb-12">
          <div className="relative group">
            <div className="absolute inset-0 bg-blue-600 rounded-[2rem] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
            <div className="w-24 h-24 rounded-[2rem] bg-white flex items-center justify-center shadow-2xl relative z-10 transform group-hover:scale-105 transition-transform duration-500 overflow-hidden border-4 border-white">
              <img src="/equiperogerio/logo.png" alt="7 Boss" className="w-full h-full object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove('hidden') }} />
              <Shield className="w-12 h-12 text-blue-600 hidden" />
            </div>
          </div>
          <div className="mt-6 text-center">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">7 Boss</h1>
            <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest mt-3 opacity-70">Gestão eficiente para toda sua equipe</p>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/20 dark:border-white/5 p-8 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="flex items-center gap-2 justify-center mb-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              <span className="text-[10px] font-black uppercase text-blue-500 tracking-[0.3em]">Acesso Seguro</span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">CPF</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input id="login-cpf" type="text" inputMode="numeric" placeholder="000.000.000-00"
                  value={cpf} onChange={e => setCpf(formatCPF(e.target.value))}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent focus:border-blue-500/50 rounded-2xl h-14 text-sm font-bold text-foreground placeholder:text-muted-foreground/50 outline-none transition-all" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input id="login-senha" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                  value={senha} onChange={e => setSenha(e.target.value)} autoComplete="current-password"
                  className="w-full pl-12 pr-12 py-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent focus:border-blue-500/50 rounded-2xl h-14 text-sm font-bold text-foreground placeholder:text-muted-foreground/50 outline-none transition-all" />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors">
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button type="submit" loading={loading}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
              Entrar <ArrowRight className="w-5 h-5" />
            </Button>
          </form>
        </div>
        <p className="text-center text-[10px] font-black uppercase text-slate-400 tracking-widest mt-10 opacity-50">Gestão eficiente para toda sua equipe</p>
      </div>
    </div>
  )
}
