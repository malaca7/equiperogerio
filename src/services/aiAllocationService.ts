import { supabase } from '../lib/supabase'
import type { Funcionario } from '../lib/database.types'

export interface HistoricalEscala {
  funcionario_id: string
  data: string
  tipo: string
  localidade: string | null
}

export interface HistoricalFrequencia {
  funcionario_id: string
  data: string
  status: string
}

export interface CandidateAffinity {
  funcionarioId: string
  funcionarioNome: string
  funcionarioCargo: string
  funcionarioSetor: string
  score: number
  matchPercent: number
  reasons: string[]
  localityDays: number
  sectorDays: number
  bestPartnerId?: string
  bestPartnerName?: string
  bestPartnerDays: number
  attendanceRate: number
  isEligible: boolean
  ineligibilityReason?: string
}

export interface SuggestedAllocation {
  id: string
  funcionarioId: string
  funcionarioNome: string
  funcionarioCargo: string
  funcionarioSetor: string
  localidadeId: string
  localidadeNome: string
  localidadeSetor: string
  score: number
  matchPercent: number
  reasons: string[]
  bestPartnerName?: string
  status: 'pending' | 'approved' | 'rejected'
}

export interface AIProcessedEngine {
  empLocHist: Record<string, Record<string, number>>
  empSectorHist: Record<string, Record<string, number>>
  pairHist: Record<string, Record<string, number>>
  attendanceHist: Record<string, { total: number; presente: number; falta: number }>
  recentLocality: Record<string, string>
  recentSector: Record<string, string>
  latestAllocation: Record<string, { localityName: string; date: string; setor?: string }>
  localityLastDateMap: Record<string, Record<string, string>>
  localityPatternMap: Record<string, Record<string, number>>
}

/**
 * Universal accent-insensitive & case-insensitive normalization string helper
 */
export const normStr = (s: string | null | undefined): string =>
  s ? s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ""

/**
 * Fetch past 90 days of escalas & frequencias for deep AI analysis
 */
export async function fetchHistoricalAIContext(startDateStr: string): Promise<{
  escalas: HistoricalEscala[]
  frequencias: HistoricalFrequencia[]
}> {
  try {
    const end = startDateStr
    const startObj = new Date(startDateStr)
    startObj.setDate(startObj.getDate() - 90)
    const start = startObj.toISOString().split('T')[0]

    const [escalasRes, freqRes] = await Promise.all([
      supabase
        .from('escalas')
        .select('funcionario_id, data, tipo, localidade')
        .gte('data', start)
        .lte('data', end)
        .order('data', { ascending: false })
        .limit(5000),
      supabase
        .from('frequencia')
        .select('funcionario_id, data, status')
        .gte('data', start)
        .lte('data', end)
        .order('data', { ascending: false })
        .limit(5000)
    ])

    return {
      escalas: (escalasRes.data as HistoricalEscala[]) || [],
      frequencias: (freqRes.data as HistoricalFrequencia[]) || []
    }
  } catch (err) {
    console.error('Erro ao buscar histórico para IA Copiloto:', err)
    return { escalas: [], frequencias: [] }
  }
}

/**
 * Build fast lookup index maps for sector experience, locality experience, pair co-working, and attendance
 */
export function buildAIEngine(
  escalas: HistoricalEscala[],
  frequencias: HistoricalFrequencia[],
  funcionarios: Funcionario[],
  localidadesMap?: Record<string, string> // normalized localityName -> sectorName
): AIProcessedEngine {
  const empLocHist: Record<string, Record<string, number>> = {}
  const empSectorHist: Record<string, Record<string, number>> = {}
  const pairHist: Record<string, Record<string, number>> = {}
  const attendanceHist: Record<string, { total: number; presente: number; falta: number }> = {}
  const recentLocality: Record<string, string> = {}
  const recentSector: Record<string, string> = {}
  const latestAllocation: Record<string, { localityName: string; date: string; setor?: string }> = {}
  const localityLastDateMap: Record<string, Record<string, string>> = {}
  const localityPatternMap: Record<string, Record<string, number>> = {}
  const recentActiveShifts: Record<string, string[]> = {}

  const funcMap: Record<string, Funcionario> = {}
  funcionarios.forEach(f => { funcMap[String(f.id).trim()] = f })

  const dateLocalityMap: Record<string, string[]> = {}

  escalas.forEach(esc => {
    if (!esc.funcionario_id) return
    const fId = String(esc.funcionario_id).trim()
    const rawLoc = esc.localidade?.trim()
    const tipo = esc.tipo ? String(esc.tipo).toLowerCase().trim() : 'presente'

    const isAbsence = ['falta', 'atestado', 'suspensao', 'ferias', 'repouso', 'compensar'].includes(tipo)

    if (rawLoc && rawLoc.length > 0 && !isAbsence) {
      const locKey = normStr(rawLoc)
      const dStr = esc.data ? esc.data.substring(0, 10) : ''

      if (!latestAllocation[fId]) {
        latestAllocation[fId] = { localityName: rawLoc, date: dStr }
        recentLocality[fId] = rawLoc
      }

      if (!localityLastDateMap[fId]) localityLastDateMap[fId] = {}
      if (!localityLastDateMap[fId][locKey]) {
        localityLastDateMap[fId][locKey] = dStr
      }

      if (!recentActiveShifts[fId]) recentActiveShifts[fId] = []
      if (recentActiveShifts[fId].length < 5) {
        recentActiveShifts[fId].push(dStr)
        if (!localityPatternMap[fId]) localityPatternMap[fId] = {}
        localityPatternMap[fId][locKey] = (localityPatternMap[fId][locKey] || 0) + 1
      }

      if (!empLocHist[fId]) empLocHist[fId] = {}
      empLocHist[fId][locKey] = (empLocHist[fId][locKey] || 0) + 1

      // Resolve sector name
      let sectorName = localidadesMap?.[locKey] || funcMap[fId]?.setor || 'Geral'
      if (!sectorName) sectorName = 'Geral'
      const sectorKey = normStr(sectorName)

      if (!empSectorHist[fId]) empSectorHist[fId] = {}
      empSectorHist[fId][sectorKey] = (empSectorHist[fId][sectorKey] || 0) + 1
      if (!recentSector[fId]) recentSector[fId] = sectorName

      const key = `${dStr}___${locKey}`
      if (!dateLocalityMap[key]) dateLocalityMap[key] = []
      if (!dateLocalityMap[key].includes(fId)) {
        dateLocalityMap[key].push(fId)
      }
    }
  })

  // 2. Co-Worker Pair Matrix
  Object.values(dateLocalityMap).forEach(colleagues => {
    if (colleagues.length < 2) return
    for (let i = 0; i < colleagues.length; i++) {
      for (let j = i + 1; j < colleagues.length; j++) {
        const c1 = colleagues[i]
        const c2 = colleagues[j]

        if (!pairHist[c1]) pairHist[c1] = {}
        if (!pairHist[c2]) pairHist[c2] = {}

        pairHist[c1][c2] = (pairHist[c1][c2] || 0) + 1
        pairHist[c2][c1] = (pairHist[c2][c1] || 0) + 1
      }
    }
  })

  // 3. Attendance Rate
  frequencias.forEach(fr => {
    const fId = String(fr.funcionario_id).trim()
    if (!attendanceHist[fId]) attendanceHist[fId] = { total: 0, presente: 0, falta: 0 }
    attendanceHist[fId].total += 1
    const st = String(fr.status || '').toLowerCase().trim()
    if (st === 'presente' || st === 'hora_extra') {
      attendanceHist[fId].presente += 1
    } else if (st === 'falta') {
      attendanceHist[fId].falta += 1
    }
  })

  return {
    empLocHist,
    empSectorHist,
    pairHist,
    attendanceHist,
    recentLocality,
    recentSector,
    latestAllocation,
    localityLastDateMap,
    localityPatternMap
  }
}

/**
 * Calculate candidate affinity score and explanations for a given location,
 * prioritizing the latest allocations and recent pattern consistency.
 */
export function calculateAffinityScore(
  func: Funcionario,
  targetLocalityName: string,
  targetLocalitySetor: string | undefined,
  currentTeamAllocatedIds: string[],
  engine: AIProcessedEngine,
  funcMap: Record<string, Funcionario>
): CandidateAffinity {
  const fId = String(func.id).trim()
  const locKey = normStr(targetLocalityName)
  const targetSectorKey = normStr(targetLocalitySetor)
  const funcSectorKey = normStr(func.setor)

  const latestAlloc = engine.latestAllocation?.[fId]
  const isLatestLocality = latestAlloc && normStr(latestAlloc.localityName) === locKey
  const patternCount = engine.localityPatternMap?.[fId]?.[locKey] || 0
  const lastWorkedDate = engine.localityLastDateMap?.[fId]?.[locKey]

  // 1. Recency & Pattern Priority (Weight 45)
  let recencyScore = 0
  if (isLatestLocality) {
    recencyScore = 45 // Maximum recency bonus for exact latest allocation
  } else if (patternCount >= 2) {
    recencyScore = 35 // High score for strong recent pattern
  } else if (patternCount === 1) {
    recencyScore = 25
  } else if (lastWorkedDate) {
    recencyScore = 15
  }

  // 2. Historical Locality Experience Frequency (Weight 20)
  const locHist = engine.empLocHist[fId] || {}
  const localityDays = locHist[locKey] || 0
  const locScore = Math.min(localityDays * 2, 20)

  // 3. Sector Compatibility (Weight 15)
  const sectorHist = engine.empSectorHist?.[fId] || {}
  const sectorDays = targetSectorKey ? (sectorHist[targetSectorKey] || 0) : 0
  const isDirectSectorMatch = funcSectorKey && targetSectorKey && funcSectorKey === targetSectorKey

  let sectorScore = 0
  if (isDirectSectorMatch) {
    sectorScore = 10 + Math.min(sectorDays * 0.5, 5)
  } else if (sectorDays > 0) {
    sectorScore = Math.min(sectorDays * 1.0, 10)
  }

  // 4. Co-Working Affinity Matrix (Weight 12)
  let bestPartnerId: string | undefined
  let bestPartnerName: string | undefined
  let bestPartnerDays = 0
  let totalCoWorkScore = 0

  const funcPairs = engine.pairHist[fId] || {}
  currentTeamAllocatedIds.forEach(colleagueId => {
    const cIdStr = String(colleagueId).trim()
    if (cIdStr === fId) return
    const daysTogether = funcPairs[cIdStr] || 0
    if (daysTogether > bestPartnerDays) {
      bestPartnerDays = daysTogether
      bestPartnerId = cIdStr
      bestPartnerName = funcMap[cIdStr]?.nome || funcMap[cIdStr]?.apelido || undefined
    }
    totalCoWorkScore += daysTogether
  })

  const pairScore = Math.min(totalCoWorkScore * 2.5, 12)

  // 5. Attendance Rate / Assiduidade (Weight 8)
  const att = engine.attendanceHist[fId] || { total: 0, presente: 0, falta: 0 }
  const attendanceRate = att.total > 0 ? Math.round((att.presente / att.total) * 100) : 100
  const attendanceScore = (attendanceRate / 100) * 8

  // Final Composite Score (0 - 99)
  let totalScore = Math.round(recencyScore + locScore + sectorScore + pairScore + attendanceScore)
  totalScore = Math.min(Math.max(totalScore, 5), 99)

  // Build Explanatory Reasons
  const reasons: string[] = []
  if (isLatestLocality) {
    reasons.push(`📍 Última alocação neste posto (${latestAlloc.date ? latestAlloc.date.split('-').reverse().slice(0, 2).join('/') : ''})`)
  } else if (patternCount >= 2) {
    reasons.push(`🔁 Padrão mantido (${patternCount}/5 alocações recentes)`)
  } else if (localityDays > 0) {
    reasons.push(`🔥 Escalado ${localityDays}x nesta localidade`)
  } else {
    reasons.push(`✨ Novo neste posto`)
  }

  if (isDirectSectorMatch) {
    reasons.push(`🎯 Setor ${func.setor} Prioritário`)
  } else if (sectorDays > 0) {
    reasons.push(`📌 ${sectorDays}x no Setor ${targetLocalitySetor || ''}`)
  }

  if (bestPartnerName && bestPartnerDays > 0) {
    reasons.push(`🤝 ${bestPartnerDays}x com ${bestPartnerName.split(' ')[0]}`)
  }

  if (attendanceRate >= 90) {
    reasons.push(`⭐ ${attendanceRate}% Assiduidade`)
  } else if (att.falta > 0) {
    reasons.push(`⚠️ ${att.falta} faltas recentes`)
  }

  return {
    funcionarioId: func.id,
    funcionarioNome: func.nome,
    funcionarioCargo: func.cargo,
    funcionarioSetor: func.setor,
    score: totalScore,
    matchPercent: totalScore,
    reasons,
    localityDays,
    sectorDays,
    bestPartnerId,
    bestPartnerName,
    bestPartnerDays,
    attendanceRate,
    isEligible: true
  }
}

/**
 * Generate Real-World Smart Auto-Allocations
 * Prioritizes latest allocations and recent pattern consistency FIRST.
 */
export function generateSmartAutoAllocations(
  unallocatedFuncionarios: Funcionario[],
  localidades: { id: string; nome: string; setor: string }[],
  allocatedMap: Record<string, string[]>, // localityId -> funcionarioId[]
  engine: AIProcessedEngine,
  funcMap: Record<string, Funcionario>
): SuggestedAllocation[] {
  const suggestions: SuggestedAllocation[] = []
  const availableFuncs = [...unallocatedFuncionarios]
  
  if (availableFuncs.length === 0 || localidades.length === 0) {
    return []
  }

  // Track dynamically allocated workers per locality in this session
  const sessionAllocatedMap: Record<string, string[]> = {}
  localidades.forEach(loc => {
    sessionAllocatedMap[loc.id] = [...(allocatedMap[loc.id] || [])]
  })

  const allocatedFuncIds = new Set<string>()

  // PASS 1: Latest Allocations & Pattern Consistency Priority
  const experiencedPairs: {
    func: Funcionario
    loc: { id: string; nome: string; setor: string }
    affinity: CandidateAffinity
    isLatest: boolean
    patternCount: number
  }[] = []

  availableFuncs.forEach(func => {
    const fId = String(func.id).trim()
    const latestAlloc = engine.latestAllocation?.[fId]

    localidades.forEach(loc => {
      const locKey = normStr(loc.nome)
      const isLatest = latestAlloc ? normStr(latestAlloc.localityName) === locKey : false
      const patternCount = engine.localityPatternMap?.[fId]?.[locKey] || 0
      const days = engine.empLocHist?.[fId]?.[locKey] || 0

      if (isLatest || patternCount > 0 || days > 0) {
        const currentTeam = sessionAllocatedMap[loc.id] || []
        const affinity = calculateAffinityScore(func, loc.nome, loc.setor, currentTeam, engine, funcMap)
        experiencedPairs.push({ func, loc, affinity, isLatest, patternCount })
      }
    })
  })

  // Sort strictly by: 1. Latest allocation match, 2. Highest pattern count, 3. Overall affinity score
  experiencedPairs.sort((a, b) => {
    if (a.isLatest !== b.isLatest) return a.isLatest ? -1 : 1
    if (a.patternCount !== b.patternCount) return b.patternCount - a.patternCount
    return b.affinity.score - a.affinity.score
  })

  experiencedPairs.forEach(pair => {
    if (allocatedFuncIds.has(pair.func.id)) return

    suggestions.push({
      id: `sug_${pair.func.id}_${pair.loc.id}_exp`,
      funcionarioId: pair.func.id,
      funcionarioNome: pair.func.nome,
      funcionarioCargo: pair.func.cargo,
      funcionarioSetor: pair.func.setor || 'Operacional',
      localidadeId: pair.loc.id,
      localidadeNome: pair.loc.nome,
      localidadeSetor: pair.loc.setor || 'Geral',
      score: pair.affinity.score,
      matchPercent: pair.affinity.matchPercent,
      reasons: pair.affinity.reasons,
      bestPartnerName: pair.affinity.bestPartnerName,
      status: 'pending'
    })

    sessionAllocatedMap[pair.loc.id].push(pair.func.id)
    allocatedFuncIds.add(pair.func.id)
  })

  // Filter remaining unallocated workers
  let remainingFuncs = availableFuncs.filter(f => !allocatedFuncIds.has(f.id))

  // PASS 2: Same-Sector Priority Pass for remaining workers
  if (remainingFuncs.length > 0) {
    localidades.forEach(loc => {
      if (remainingFuncs.length === 0) return

      const targetSecKey = normStr(loc.setor)
      const sameSectorFuncs = remainingFuncs.filter(f => normStr(f.setor) === targetSecKey)

      if (sameSectorFuncs.length > 0) {
        const currentTeam = sessionAllocatedMap[loc.id] || []
        const ranked = sameSectorFuncs
          .map(func => ({
            func,
            affinity: calculateAffinityScore(func, loc.nome, loc.setor, currentTeam, engine, funcMap)
          }))
          .sort((a, b) => b.affinity.score - a.affinity.score)

        if (ranked.length > 0) {
          const topMatch = ranked[0]
          suggestions.push({
            id: `sug_${topMatch.func.id}_${loc.id}_sec`,
            funcionarioId: topMatch.func.id,
            funcionarioNome: topMatch.func.nome,
            funcionarioCargo: topMatch.func.cargo,
            funcionarioSetor: topMatch.func.setor || 'Operacional',
            localidadeId: loc.id,
            localidadeNome: loc.nome,
            localidadeSetor: loc.setor || 'Geral',
            score: topMatch.affinity.score,
            matchPercent: topMatch.affinity.matchPercent,
            reasons: topMatch.affinity.reasons,
            bestPartnerName: topMatch.affinity.bestPartnerName,
            status: 'pending'
          })

          sessionAllocatedMap[loc.id].push(topMatch.func.id)
          allocatedFuncIds.add(topMatch.func.id)
          remainingFuncs = remainingFuncs.filter(f => f.id !== topMatch.func.id)
        }
      }
    })
  }

  // PASS 3: Balance remaining unallocated workers across localities
  const maxPasses = remainingFuncs.length
  let passCount = 0

  while (remainingFuncs.length > 0 && passCount < maxPasses) {
    passCount++
    let allocatedInThisPass = false

    const sortedLocalities = [...localidades].sort((a, b) => {
      const countA = sessionAllocatedMap[a.id]?.length || 0
      const countB = sessionAllocatedMap[b.id]?.length || 0
      return countA - countB
    })

    for (const loc of sortedLocalities) {
      if (remainingFuncs.length === 0) break

      const currentTeam = sessionAllocatedMap[loc.id] || []
      const rankedCandidates = remainingFuncs
        .map(func => ({
          func,
          affinity: calculateAffinityScore(func, loc.nome, loc.setor, currentTeam, engine, funcMap)
        }))
        .sort((a, b) => b.affinity.score - a.affinity.score)

      if (rankedCandidates.length > 0) {
        const topMatch = rankedCandidates[0]

        suggestions.push({
          id: `sug_${topMatch.func.id}_${loc.id}_p3_${passCount}`,
          funcionarioId: topMatch.func.id,
          funcionarioNome: topMatch.func.nome,
          funcionarioCargo: topMatch.func.cargo,
          funcionarioSetor: topMatch.func.setor || 'Operacional',
          localidadeId: loc.id,
          localidadeNome: loc.nome,
          localidadeSetor: loc.setor || 'Geral',
          score: topMatch.affinity.score,
          matchPercent: topMatch.affinity.matchPercent,
          reasons: topMatch.affinity.reasons,
          bestPartnerName: topMatch.affinity.bestPartnerName,
          status: 'pending'
        })

        sessionAllocatedMap[loc.id].push(topMatch.func.id)
        allocatedFuncIds.add(topMatch.func.id)
        remainingFuncs = remainingFuncs.filter(f => f.id !== topMatch.func.id)
        allocatedInThisPass = true
      }
    }

    if (!allocatedInThisPass) break
  }

  return suggestions
}

