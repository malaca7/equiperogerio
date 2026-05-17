import React, { useState, useEffect } from 'react'
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
  const [lembrarCpf, setLembrarCpf] = useState(false)

  useEffect(() => {
    const salvo = localStorage.getItem('7boss_lembrar_cpf')
    if (salvo) {
      setCpf(formatCPF(salvo))
      setLembrarCpf(true)
    }
  }, [])

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
    
    if (lembrarCpf) {
      localStorage.setItem('7boss_lembrar_cpf', cleanCpf)
    } else {
      localStorage.removeItem('7boss_lembrar_cpf')
    }

    setLoading(true)
    const { error } = await signIn(cleanCpf, senha)
    setLoading(false)
    if (error) toast(error, 'error')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#f8fafc] relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-200/50 via-[#f8fafc] to-[#f8fafc]"></div>

      <div className="relative w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-200 mb-6 overflow-hidden">
            <img 
              src="/equiperogerio/logo.png" 
              alt="7 Boss Logo" 
              className="w-full h-full object-contain"
              onError={(e) => { 
                e.currentTarget.style.display = 'none'; 
                (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove('hidden') 
              }} 
            />
            <Shield className="w-10 h-10 text-blue-700 hidden" strokeWidth={1.5} />
          </div>
          
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">7 Boss</h1>
            <p className="text-xs font-semibold uppercase text-slate-500 tracking-widest mt-2">
              Gestão Eficiente
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div className="text-center mb-6">
              <h2 className="text-lg font-bold text-slate-800">Acesso ao Sistema</h2>
              <p className="text-sm text-slate-500 mt-1">Insira suas credenciais para continuar</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-600 ml-1">CPF</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input 
                  id="login-cpf" 
                  type="text" 
                  inputMode="numeric" 
                  placeholder="000.000.000-00"
                  value={cpf} 
                  onChange={e => setCpf(formatCPF(e.target.value))}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition-all" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-600 ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input 
                  id="login-senha" 
                  type={showPass ? 'text' : 'password'} 
                  placeholder="••••••••"
                  value={senha} 
                  onChange={e => setSenha(e.target.value)} 
                  autoComplete="current-password"
                  className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition-all" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center justify-center w-5 h-5">
                  <input 
                    type="checkbox" 
                    checked={lembrarCpf}
                    onChange={e => setLembrarCpf(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-4.5 h-4.5 border-2 border-slate-300 rounded transition-all peer-checked:bg-blue-600 peer-checked:border-blue-600 group-hover:border-blue-400"></div>
                  <svg className="absolute w-3 h-3 text-white scale-0 transition-transform peer-checked:scale-100 pointer-events-none" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-800 transition-colors select-none">Lembrar meu CPF</span>
              </label>
            </div>

            <Button 
              type="submit" 
              loading={loading}
              className="w-full h-12 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm shadow-md shadow-blue-700/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
            >
              Entrar <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-[11px] font-semibold text-slate-400">
            &copy; {new Date().getFullYear()} 7 Boss. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}
