import { lazy, type ComponentType } from 'react'

/**
 * Enhanced React.lazy wrapper that automatically catches chunk loading failures
 * (common when a new version of the app is deployed) and reloads the page to fetch fresh assets.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const pageKey = '7boss_chunk_reloaded'
    try {
      const component = await componentImport()
      sessionStorage.removeItem(pageKey)
      return component
    } catch (error: any) {
      const isChunkError =
        error?.name === 'TypeError' ||
        (error?.message && (
          error.message.includes('Failed to fetch dynamically imported module') ||
          error.message.includes('Importing a module script failed') ||
          error.message.includes('error loading dynamically imported module')
        ))

      const hasReloaded = sessionStorage.getItem(pageKey)

      if (isChunkError && !hasReloaded) {
        sessionStorage.setItem(pageKey, 'true')
        window.location.reload()
        return new Promise<{ default: T }>(() => {})
      }

      throw error
    }
  })
}
