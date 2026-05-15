import React from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Calendar,
  FileText,
  Umbrella,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { TopHeader } from '../components/layout/TopHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Loading, Skeleton } from '../components/ui/Loading'
import { useDashboardStats } from '../hooks/useFrequencia'
import { useFrequenciaMensal } from '../hooks/useFrequencia'
import { today, currentMonth, formatDate } from '../lib/utils'

const currentDate = today()
const currentMonthStr = currentMonth()

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
  bgColor: string
}

function StatCard({ label, value, icon: Icon, color, bgColor }: StatCardProps) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${bgColor}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium">{label}</p>
        <p className="text-xl font-bold text-[hsl(var(--foreground))]">{value}</p>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats(currentDate)
  const { data: mensal } = useFrequenciaMensal(currentMonthStr)

  const today = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })

  // Compute weekly chart data from monthly
  const weeklyData = React.useMemo(() => {
    if (!mensal) return []
    const byDay: Record<string, { presentes: number; faltas: number }> = {}
    mensal.forEach(f => {
      if (!byDay[f.data]) byDay[f.data] = { presentes: 0, faltas: 0 }
      if (f.status === 'presente' || f.status === 'hora_extra') byDay[f.data].presentes++
      if (f.status === 'falta') byDay[f.data].faltas++
    })
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([date, vals]) => ({
        day: format(new Date(date + 'T00:00:00'), 'EEE', { locale: ptBR }),
        ...vals,
      }))
  }, [mensal])

  const pieData = stats ? [
    { name: 'Presentes', value: stats.presentes, color: '#22c55e' },
    { name: 'Faltas', value: stats.faltas, color: '#ef4444' },
    { name: 'Atestados', value: stats.atestados, color: '#f59e0b' },
    { name: 'Folgas', value: stats.folgas, color: '#3b82f6' },
    { name: 'Férias', value: stats.ferias, color: '#10b981' },
  ].filter(d => d.value > 0) : []

  return (
    <div className="main-content">
      <TopHeader
        title="Dashboard"
        subtitle={today}
      />

      <div className="px-4 pt-2 pb-4 space-y-4">
        {/* Welcome banner */}
        <div className="card p-5 bg-gradient-to-br from-blue-600 to-indigo-600 border-none text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-100 text-xs font-medium uppercase tracking-wide">Encarregado</p>
              <h2 className="text-lg font-bold mt-0.5">Rogerio — Controle Diário</h2>
              <p className="text-blue-200 text-sm mt-1 capitalize">{today}</p>
            </div>
            <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
          {stats && (
            <div className="mt-4 pt-4 border-t border-white/20 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-300" />
                <span className="text-sm font-semibold">{stats.presentes} presentes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-300" />
                <span className="text-sm font-semibold">{stats.faltas} faltas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-300" />
                <span className="text-sm font-semibold">{stats.totalAtivos} ativos</span>
              </div>
            </div>
          )}
        </div>

        {/* Stats grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Presentes"
              value={stats.presentes}
              icon={UserCheck}
              color="text-emerald-600 dark:text-emerald-500"
              bgColor="bg-emerald-500/10 border-emerald-500/20"
            />
            <StatCard
              label="Faltas"
              value={stats.faltas}
              icon={UserX}
              color="text-red-600 dark:text-red-500"
              bgColor="bg-red-500/10 border-red-500/20"
            />
            <StatCard
              label="Atestados"
              value={stats.atestados}
              icon={FileText}
              color="text-amber-600 dark:text-amber-500"
              bgColor="bg-amber-500/10 border-amber-500/20"
            />
            <StatCard
              label="Folgas"
              value={stats.folgas}
              icon={Umbrella}
              color="text-blue-600 dark:text-blue-500"
              bgColor="bg-blue-500/10 border-blue-500/20"
            />
            <StatCard
              label="Horas Extra"
              value={`${stats.horasExtras}h`}
              icon={Clock}
              color="text-purple-600 dark:text-purple-500"
              bgColor="bg-purple-500/10 border-purple-500/20"
            />
            <StatCard
              label="Total Ativos"
              value={stats.totalAtivos}
              icon={Users}
              color="text-indigo-600 dark:text-indigo-500"
              bgColor="bg-indigo-500/10 border-indigo-500/20"
            />
          </div>
        ) : null}

        {/* Alert: sem registros */}
        {stats && stats.totalRegistros === 0 && (
          <div className="card p-4 border-l-4 border-l-amber-500 bg-amber-500/10 flex items-center gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                Nenhuma frequência hoje
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-500">
                Registre a frequência da sua equipe na aba Frequência
              </p>
            </div>
          </div>
        )}

        {/* Pie chart — distribuição do dia */}
        {pieData.length > 0 && (
          <Card className="p-4">
            <CardHeader>
              <CardTitle className="text-sm">Distribuição de Hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1.5 flex-1">
                  {pieData.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">{d.name}</span>
                      <span className="text-xs font-semibold text-[hsl(var(--foreground))] ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weekly bar chart */}
        {weeklyData.length > 0 && (
          <Card className="p-4">
            <CardHeader>
              <CardTitle className="text-sm">Últimos 7 dias</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={weeklyData} barGap={2} barCategoryGap="30%">
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="presentes" name="Presentes" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="faltas" name="Faltas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <a href="/frequencia" className="card p-4 bg-card flex flex-col items-center gap-2 text-center active:scale-95 transition-transform shadow-sm border border-border rounded-3xl hover:border-blue-400">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-semibold text-[hsl(var(--foreground))]">Marcar Frequência</span>
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Registro rápido</span>
          </a>
          <a href="/escala" className="card p-4 bg-card flex flex-col items-center gap-2 text-center active:scale-95 transition-transform shadow-sm border border-border rounded-3xl hover:border-indigo-400">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-xs font-semibold text-[hsl(var(--foreground))]">Ver Escala</span>
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Calendário mensal</span>
          </a>
        </div>
      </div>
    </div>
  )
}
