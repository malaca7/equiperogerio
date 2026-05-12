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
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[hsl(var(--background))]">
      {/* Decoração de fundo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full blur-3xl" style={{ background: 'hsl(221 83% 53% / 0.08)' }} />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full blur-3xl" style={{ background: 'hsl(221 83% 53% / 0.05)' }} />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-glow mb-4"
            style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}>
            <Shield className="w-8 h-8" style={{ color: 'white' }} />
          </div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] text-center">
            Gestão de Equipe
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 text-center">
            Controle de frequência e escala
          </p>
        </div>

        {/* Formulário */}
        <div className="card p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              id="login-usuario"
              type="text"
              label="Usuário"
              placeholder="Ex: rogerio"
              value={usuario}
              onChange={e => setUsuario(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
            />

            <div className="relative">
              <Input
                id="login-senha"
                type={showPass ? 'text' : 'password'}
                label="Senha"
                placeholder="••••••••"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 bottom-3.5 text-[hsl(var(--muted-foreground))] transition-colors"
                aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPass
                  ? <EyeOff className="w-4 h-4" />
                  : <Eye className="w-4 h-4" />
                }
              </button>
            </div>

            <Button
              type="submit"
              className="w-full mt-2"
              style={{ paddingTop: '0.875rem', paddingBottom: '0.875rem' }}
              loading={loading}
            >
              Entrar
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-[hsl(var(--muted-foreground))] mt-6">
          Acesso exclusivo — Encarregado Rogerio
        </p>
      </div>
    </div>
  )
}
