import React, { useState } from 'react'
import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import { Shield, Users, Key, ScrollText, AlertTriangle, ChevronLeft, Settings2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { TopHeader } from '../../components/layout/TopHeader'
import { cn } from '../../lib/utils'
import { AdminUsersPage } from './AdminUsersPage'
import { AdminRolesPage } from './AdminRolesPage'
import { AdminAuditPage } from './AdminAuditPage'

const adminNav = [
  { to: '/admin/usuarios', icon: Users, label: 'Usuários' },
  { to: '/admin/cargos', icon: Key, label: 'Cargos' },
  { to: '/admin/auditoria', icon: ScrollText, label: 'Auditoria' },
]

export function AdminDashboard() {
  const { isAdmin, user } = useAuth()
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopHeader title="Administração" subtitle="Controle de Acessos e Segurança" />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-32">
        {/* Admin nav pills */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
          <NavLink to="/" className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </NavLink>
          <div className="w-px h-6 bg-border/50 mx-1 shrink-0" />
          {adminNav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cn(
              "shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all",
              isActive ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}>
              <Icon className="w-4 h-4" /> {label}
            </NavLink>
          ))}
        </div>

        <Routes>
          <Route path="usuarios" element={<AdminUsersPage />} />
          <Route path="cargos" element={<AdminRolesPage />} />
          <Route path="auditoria" element={<AdminAuditPage />} />
          <Route path="*" element={<Navigate to="usuarios" replace />} />
        </Routes>
      </div>
    </div>
  )
}
