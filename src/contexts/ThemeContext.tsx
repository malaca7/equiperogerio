import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dim' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  isSidebarCollapsed: boolean
  setIsSidebarCollapsed: (v: boolean) => void
  isMobileMenuOpen: boolean
  setIsMobileMenuOpen: (v: boolean) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored) return stored
    return 'light'
  })

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dim', 'dark')
    document.documentElement.classList.add(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  const toggleTheme = () => {
    setTheme(t => {
      if (t === 'light') return 'dim'
      if (t === 'dim') return 'dark'
      return 'light'
    })
  }

  return (
    <ThemeContext.Provider value={{
      theme,
      toggleTheme,
      isSidebarCollapsed,
      setIsSidebarCollapsed,
      isMobileMenuOpen,
      setIsMobileMenuOpen
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
