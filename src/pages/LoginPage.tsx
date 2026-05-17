import React, { useState } from 'react'
import { Eye, EyeOff, Shield } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function LoginPage() {
  const { signIn } = useAuth()
  const { toast } = useToast()
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario || !senha) {
      toast('Preencha usuário e senha', 'warning')
      return
    }
    setLoading(true)
    const { error } = await signIn(usuario, senha)
    setLoading(false)
    if (error) {
      toast(error, 'error')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      {/* Decoração de fundo dinâmica */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-emerald-600/10 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light" />
      </div>

      <div className="relative w-full max-w-sm z-10">
        {/* Logo de Elite */}
        <div className="flex flex-col items-center mb-12">
          <div className="relative group">
            <div className="absolute inset-0 bg-blue-600 rounded-[2rem] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
            <div className="w-24 h-24 rounded-[2rem] bg-white flex items-center justify-center shadow-2xl relative z-10 transform group-hover:scale-105 transition-transform duration-500 overflow-hidden border-4 border-white">
              <img 
                src="/equiperogerio/logo.png" 
                alt="7 Boss Logo" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <Shield className="w-12 h-12 text-blue-600 hidden" />
            </div>
          </div>
          <div className="mt-6 text-center">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
              7 Boss
            </h1>
            <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest mt-3 opacity-70">
              Gestão eficiente para toda sua equipe
            </p>
          </div>
        </div>

        {/* Formulário Glassmorphism */}
        <div className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/20 dark:border-white/5 p-8 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-2xl space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Identificação</label>
              <Input
                id="login-usuario"
                type="text"
                placeholder="Nome de usuário"
                value={usuario}
                onChange={e => setUsuario(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                className="bg-slate-50 dark:bg-slate-800/50 border-transparent focus:border-blue-500/50 rounded-2xl h-14"
              />
            </div>

            <div className="space-y-1 relative">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Chave de Acesso</label>
              <div className="relative">
                <Input
                  id="login-senha"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  autoComplete="current-password"
                  className="bg-slate-50 dark:bg-slate-800/50 border-transparent focus:border-blue-500/50 rounded-2xl h-14"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 mt-4 active:scale-95 transition-all"
              loading={loading}
            >
              Acessar Sistema
            </Button>
          </form>
        </div>

        <p className="text-center text-[10px] font-black uppercase text-slate-400 tracking-widest mt-10 opacity-50">
          Gestão eficiente para toda sua equipe
        </p>
      </div>
    </div>
  )
}
