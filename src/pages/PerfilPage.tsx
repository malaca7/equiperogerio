import React, { useState } from 'react'
import { User, Mail, Shield, KeyRound, Save, Eye, EyeOff, AlertCircle, Camera } from 'lucide-react'
import { TopHeader } from '../components/layout/TopHeader'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { useConfiguracao, useUpdateConfiguracao } from '../hooks/useConfiguracoes'

export function PerfilPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const { data: userPhotos = {} } = useConfiguracao<Record<string, string>>('fotos_usuarios', {})
  const updateConfig = useUpdateConfiguracao()

  // State for editable profile fields
  const [nome, setNome] = useState(user?.profile?.nome ?? '')
  const [email, setEmail] = useState(user?.profile?.email ?? '')
  const [myFotoUrl, setMyFotoUrl] = useState('')
  
  // State for password fields
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const [isSaving, setIsSaving] = useState(false)

  React.useEffect(() => {
    if (user && userPhotos[user.profile.id]) {
      setMyFotoUrl(userPhotos[user.profile.id])
    }
  }, [user, userPhotos])

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxDim = 150
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width)
              width = maxDim
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height)
              height = maxDim
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8)
          resolve(compressedBase64)
        }
        img.onerror = (err) => reject(err)
      }
      reader.onerror = (err) => reject(err)
    })
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const base64 = await compressImage(file)
        setMyFotoUrl(base64)
      } catch (err) {
        toast('Falha ao processar a imagem do perfil.', 'error')
      }
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <TopHeader title="Meu Perfil" />
        <div className="flex items-center justify-center pt-28 sm:pt-32 pb-20 text-rose-500 font-bold">
          Usuário não autenticado.
        </div>
      </div>
    )
  }

  const userInitial = user.profile.nome?.charAt(0) ?? '?'
  const userRole = user.roles?.[0]?.nome ?? 'Sem Cargo'
  const userCpfFormatted = user.profile.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!nome.trim()) {
      toast('O nome completo é obrigatório.', 'warning')
      return
    }

    setIsSaving(true)
    try {
      // 1. Prepare fields to update directly on the profiles table
      const updateData: any = {
        nome: nome.trim(),
        email: email.trim() || null,
        updated_at: new Date().toISOString()
      }

      if (newPassword.trim()) {
        if (newPassword.length < 6) {
          toast('A senha deve ter pelo menos 6 caracteres.', 'warning')
          setIsSaving(false)
          return
        }
        if (newPassword !== confirmPassword) {
          toast('As senhas não coincidem.', 'error')
          setIsSaving(false)
          return
        }
        updateData.senha = newPassword.trim()
      }

      // 2. Update Profile Table in Supabase
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.profile.id)

      if (profileError) throw profileError

      // 3. Update User Photo in Config table if changed
      if (myFotoUrl !== (userPhotos[user.profile.id] ?? '')) {
        await updateConfig.mutateAsync({
          chave: 'fotos_usuarios',
          valor: { ...userPhotos, [user.profile.id]: myFotoUrl }
        })
      }

      toast('Perfil atualizado com sucesso!', 'success')
      
      // Clear password inputs
      setNewPassword('')
      setConfirmPassword('')

      // Reload profile state globally
      setTimeout(() => {
        window.location.reload()
      }, 1000)

    } catch (error: any) {
      toast('Erro ao atualizar perfil: ' + error.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Meu Perfil" subtitle="Edição de Dados Pessoais" />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-28 sm:pt-32">
        
        {/* Profile Elite Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Block: User Avatar & Role */}
          <div className="bg-card/85 dark:bg-card/45 backdrop-blur-2xl border border-border/50 rounded-[2.5rem] p-8 shadow-sm flex flex-col items-center text-center relative overflow-hidden h-fit">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[60px]" />
            
            {/* Massive Premium Initial/Photo Avatar with Interactive Upload */}
            <div 
              className="relative group/avatar cursor-pointer" 
              onClick={() => document.getElementById('my-profile-avatar-file-input')?.click()}
              title="Clique para alterar sua foto de perfil"
            >
              <div className="w-24 h-24 rounded-3xl ring-4 ring-primary/20 group-hover/avatar:ring-primary/45 p-1 transition-all duration-300 bg-background/50 overflow-hidden flex items-center justify-center shadow-xl shadow-primary/10 border-4 border-card z-10 relative">
                {myFotoUrl ? (
                  <img src={myFotoUrl} alt={user.profile.nome} className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <div className="w-full h-full rounded-2xl bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center text-white text-4xl font-black">
                    {userInitial}
                  </div>
                )}
              </div>
              
              {/* Micro Edit Badge Overlay */}
              <div className="absolute bottom-[-6px] right-[-6px] w-8 h-8 rounded-xl bg-primary hover:bg-primary/95 text-white flex items-center justify-center shadow-lg border-2 border-card scale-95 group-hover/avatar:scale-105 transition-all z-20">
                <Camera className="w-4 h-4" />
              </div>
            </div>

            {/* Hidden File Input */}
            <input
              id="my-profile-avatar-file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />

            <h3 className="text-2xl font-black text-foreground tracking-tight mt-6 leading-none">
              {user.profile.nome}
            </h3>
            
            <span className="inline-block mt-3 px-3 py-1 bg-primary/10 border border-primary/20 rounded-xl text-[10px] font-black uppercase text-primary tracking-widest shadow-sm">
              {userRole}
            </span>

            <div className="w-full border-t border-border/50 mt-8 pt-6 space-y-4 text-left">
              <div>
                <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Identificador (CPF)</p>
                <p className="text-sm font-black text-foreground mt-1 tracking-wider">{userCpfFormatted}</p>
              </div>

              <div>
                <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Data de Cadastro</p>
                <p className="text-xs font-semibold text-foreground mt-1">
                  {new Date(user.profile.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </div>

          {/* Right Block: Form fields for editing */}
          <div className="lg:col-span-2 bg-card/85 dark:bg-card/45 backdrop-blur-2xl border border-border/50 rounded-[2.5rem] p-8 sm:p-10 shadow-sm relative">
            
            <form onSubmit={handleSave} className="space-y-8">
              
              {/* Profile Details Section */}
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <User className="w-4 h-4" />
                  </div>
                  <h4 className="text-lg font-black text-foreground tracking-tight">Dados do Perfil</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-muted-foreground ml-1">Nome Completo</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Nome completo..."
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 text-sm bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground transition-all"
                        required
                      />
                      <User className="w-4 h-4 text-muted-foreground/50 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-muted-foreground ml-1">Endereço de E-mail</label>
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="nome@exemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 text-sm bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground transition-all"
                      />
                      <Mail className="w-4 h-4 text-muted-foreground/50 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Password Section */}
              <div className="space-y-5 pt-4 border-t border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-foreground tracking-tight">Alteração de Senha</h4>
                    <p className="text-[10px] font-bold text-muted-foreground mt-0.5 uppercase tracking-wide">Preencha apenas se desejar mudar a senha atual</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  
                  {/* New Password */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-muted-foreground ml-1">Nova Senha</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="Mínimo 6 caracteres..."
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 text-sm bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground transition-all"
                      />
                      <KeyRound className="w-4 h-4 text-muted-foreground/50 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-muted-foreground ml-1">Confirmar Nova Senha</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Repita a nova senha..."
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 text-sm bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground transition-all"
                      />
                      <KeyRound className="w-4 h-4 text-muted-foreground/50 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                </div>

                {newPassword.trim() && newPassword.length < 6 && (
                  <div className="flex items-center gap-2 text-rose-500/90 text-[10px] font-bold uppercase tracking-wider ml-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    A nova senha precisa ter no mínimo 6 caracteres.
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-end gap-3">
                <Button
                  type="submit"
                  disabled={isSaving}
                  loading={isSaving}
                  className="w-full sm:w-auto h-14 px-10 rounded-2xl bg-primary hover:bg-primary/95 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 gap-2.5 active:scale-95 transition-all"
                >
                  <Save className="w-4 h-4" /> Salvar Alterações
                </Button>
              </div>

            </form>
          </div>

        </div>

      </div>
    </div>
  )
}
