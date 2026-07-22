import React from 'react'
import { Navigate } from 'react-router-dom'

export function ConfiguracoesPage() {
  // Redirect to the unified Control Panel on the 'parametros' tab
  return <Navigate to="/admin?tab=parametros" replace />
}
