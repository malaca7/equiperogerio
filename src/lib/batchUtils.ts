import { supabase } from './supabase'

/**
 * Executes bulk upserts in chunks of specified size to avoid PostgreSQL 'canceling statement due to statement timeout'.
 * Supabase free/starter tier or tables with triggers hit timeouts when upserting large arrays in a single statement.
 */
export async function batchUpsert<T extends Record<string, any>>(
  table: string,
  items: T[],
  options: { onConflict?: string; chunkSize?: number } = {}
): Promise<T[]> {
  if (!items || items.length === 0) return []

  const chunkSize = options.chunkSize || 35
  const onConflict = options.onConflict || 'funcionario_id,data'
  const allResults: T[] = []

  // Split array into chunks of chunkSize
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }

  // Execute chunks sequentially to keep connection pool light & prevent statement timeout
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from(table)
      .upsert(chunk as any, { onConflict })
      .select()

    if (error) {
      console.error(`Error in batchUpsert for table ${table}:`, error)
      throw error
    }
    if (data) {
      allResults.push(...(data as T[]))
    }
  }

  return allResults
}
