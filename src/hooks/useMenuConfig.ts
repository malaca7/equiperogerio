import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { MenuConfig } from '../lib/auth.types'

const MENU_KEY = ['menu_config']

export function useMenuConfig(fallback: MenuConfig) {
  return useQuery<MenuConfig>({
    queryKey: MENU_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'menu_config')
        .single()
      if (error) return fallback
      
      let parsed = data?.valor as MenuConfig
      if (parsed && parsed.modulos) {
        let changed = false

        // Ensure '/escala/demandas' is present in 'producao' module
        const prodModule = parsed.modulos.find(m => m.id === 'producao')
        if (prodModule) {
          if (!prodModule.paginas) prodModule.paginas = []
          const hasDemandas = prodModule.paginas.some(p => p.rota === '/escala/demandas')
          if (!hasDemandas) {
            prodModule.paginas.push({
              id: 'localidades',
              label: 'Demandas',
              rota: '/escala/demandas',
              icone: 'FileText',
              ordem: 6.5,
              ativo: true
            })
            prodModule.paginas.sort((a, b) => a.ordem - b.ordem)
            changed = true
          }
        }

        // Clean up from inactive pages if present
        if (parsed.inativos && parsed.inativos.paginas) {
          const originalLen = parsed.inativos.paginas.length
          parsed.inativos.paginas = parsed.inativos.paginas.filter(
            entry => entry.page?.rota !== '/escala/demandas'
          )
          if (parsed.inativos.paginas.length !== originalLen) {
            changed = true
          }
        }

        parsed.modulos = parsed.modulos.map(mod => {
          if (mod.paginas) {
            mod.paginas = mod.paginas.map(pag => {
              if (pag.id === 'localidades') {
                if (pag.rota === '/escala/localidades') {
                  if (pag.label !== 'Meta e Rota' || pag.icone !== 'Navigation2') {
                    pag.label = 'Meta e Rota'
                    pag.icone = 'Navigation2'
                    changed = true
                  }
                } else if (pag.rota === '/escala/demandas') {
                  if (pag.label !== 'Demandas' || pag.icone !== 'FileText') {
                    pag.label = 'Demandas'
                    pag.icone = 'FileText'
                    changed = true
                  }
                }
              }
              if (pag.id === 'atestados') {
                if (pag.label !== 'Atestados') {
                  pag.label = 'Atestados'
                  changed = true
                }
              }
              return pag
            })
          }
          return mod
        })

        if (parsed.inativos && parsed.inativos.paginas) {
          parsed.inativos.paginas = parsed.inativos.paginas.map(entry => {
            if (entry.page && entry.page.id === 'localidades') {
              if (entry.page.rota === '/escala/localidades') {
                if (entry.page.label !== 'Meta e Rota' || entry.page.icone !== 'Navigation2') {
                  entry.page.label = 'Meta e Rota'
                  entry.page.icone = 'Navigation2'
                  changed = true
                }
              } else if (entry.page.rota === '/escala/demandas') {
                if (entry.page.label !== 'Demandas' || entry.page.icone !== 'FileText') {
                  entry.page.label = 'Demandas'
                  entry.page.icone = 'FileText'
                  changed = true
                }
              }
            }
            if (entry.page && entry.page.id === 'atestados') {
              if (entry.page.label !== 'Atestados') {
                entry.page.label = 'Atestados'
                changed = true
              }
            }
            return entry
          })
        }

        if (changed) {
          await supabase
            .from('configuracoes')
            .upsert(
              { chave: 'menu_config', valor: parsed, updated_at: new Date().toISOString() },
              { onConflict: 'chave' }
            )
        }
      }
      return (parsed ?? fallback) as MenuConfig
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useSaveMenuConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: MenuConfig) => {
      const { error } = await supabase
        .from('configuracoes')
        .upsert(
          { chave: 'menu_config', valor: config, updated_at: new Date().toISOString() },
          { onConflict: 'chave' }
        )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MENU_KEY })
    },
  })
}
