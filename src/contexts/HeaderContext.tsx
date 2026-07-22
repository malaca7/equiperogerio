import React, { createContext, useContext, useState } from 'react'

interface HeaderState {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  isVisible: boolean
  pathname: string
}

interface HeaderContextType {
  headerState: HeaderState
  setHeaderState: React.Dispatch<React.SetStateAction<HeaderState>>
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined)

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [headerState, setHeaderState] = useState<HeaderState>({
    title: '',
    subtitle: '',
    actions: null,
    isVisible: false,
    pathname: '',
  })

  return (
    <HeaderContext.Provider value={{ headerState, setHeaderState }}>
      {children}
    </HeaderContext.Provider>
  )
}

export function useHeader() {
  const context = useContext(HeaderContext)
  if (!context) throw new Error('useHeader must be used within HeaderProvider')
  return context
}
