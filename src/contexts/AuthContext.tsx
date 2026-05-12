import React, { createContext, useContext, useState, useEffect } from 'react'

const APP_USER     = import.meta.env.VITE_APP_USER     as string || 'rogerio'
const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD as string || '1234'
const SESSION_KEY  = 'ger_session'

interface AuthContextType {
  isAuthenticated: boolean
  loading: boolean
  signIn: (user: string, password: string) => Promise<{ error: string | null }>
  signOut: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  // Restore session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY)
    setIsAuthenticated(stored === 'true')
    setLoading(false)
  }, [])

  const signIn = async (user: string, password: string): Promise<{ error: string | null }> => {
    if (
      user.trim().toLowerCase() === APP_USER.toLowerCase() &&
      password === APP_PASSWORD
    ) {
      localStorage.setItem(SESSION_KEY, 'true')
      setIsAuthenticated(true)
      return { error: null }
    }
    return { error: 'Usuário ou senha incorretos' }
  }

  const signOut = () => {
    localStorage.removeItem(SESSION_KEY)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
