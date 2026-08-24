import React, { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'midnight' | 'emerald' | 'dracula' | 'bdm'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  brightness: number
  setBrightness: (val: number) => void
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
    return 'dark'
  })

  const [brightness, setBrightness] = useState<number>(() => {
    const stored = localStorage.getItem('brightness')
    return stored ? Number(stored) : 100
  })

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark', 'midnight', 'emerald', 'dracula', 'bdm', 'dim', 'bear')
    document.documentElement.classList.add(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.style.filter = brightness !== 100 ? `brightness(${brightness}%)` : ''
    localStorage.setItem('brightness', String(brightness))
  }, [brightness])

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  const toggleTheme = () => {
    setTheme(t => {
      if (t === 'dark') return 'bdm'
      if (t === 'bdm') return 'midnight'
      if (t === 'midnight') return 'emerald'
      if (t === 'emerald') return 'dracula'
      if (t === 'dracula') return 'light'
      return 'dark'
    })
  }



  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      toggleTheme,
      brightness,
      setBrightness,
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
