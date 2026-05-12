import React, { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Printer, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasMensal } from '../hooks/useEscalas'
import { Button } from '../components/ui/Button'
import { Loading } from '../components/ui/Loading'
import { escalaTipoLabel } from '../lib/utils'

const getEscalaLetra = (tipo: string) => {
  switch (tipo) {
    case 'presente': return 'X'
    case 'falta': return 'F'
    case 'falta_justificada': return 'J'
    case 'suspensao': return 'P'
    case 'atestado': return 'A'
    case 'paternidade': return 'T'
    case 'obito_familiar': return 'O'
    case 'beneficio': return 'B'
    case 'repouso': return 'R'
    case 'compensar': return 'C'
    case 'ferias': return 'FE'
    case 'transferencia': return 'TR'
    default: return '-'
  }
}

export function EscalaMensalPrint() {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(new Date())

  const startDate = startOfMonth(currentDate)
  const endDate = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: startDate, end: endDate })
  const currentMonthStr = format(startDate, 'yyyy-MM')

  const { data: allFuncionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  const funcionarios = allFuncionarios.filter(f => f.cargo?.toLowerCase() !== 'encarregado')
  const { data: escalas = [], isLoading: loadE } = useEscalasMensal(currentMonthStr)

  const handlePrint = () => {
    window.print()
  }

  if (loadF || loadE) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loading text="Carregando escala mensal..." />
      </div>
    )
  }

  const setores = Array.from(new Set(funcionarios.map(f => f.setor))).sort()

  return (
    <div className="min-h-screen bg-white text-black print:bg-white print:m-0 print:p-0">
      <div className="print:hidden p-4 bg-gray-100 border-b flex flex-wrap gap-4 items-center justify-between">
        <Button variant="secondary" onClick={() => navigate('/escala')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>

        <div className="flex items-center gap-4 bg-white rounded-lg p-1 border shadow-sm">
          <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium text-sm capitalize">
            {format(startDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <Button onClick={handlePrint} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
          <Printer className="w-4 h-4" />
          Imprimir Escala Mensal
        </Button>
      </div>

      <div className="p-8 print:p-4 max-w-[297mm] mx-auto bg-white">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold uppercase tracking-wide">Mural de Escala Mensal</h1>
          <p className="text-gray-600 font-medium text-sm mt-1 capitalize">
            {format(startDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {setores.map(setor => {
          const funcsDoSetor = funcionarios.filter(f => f.setor === setor)
          if (funcsDoSetor.length === 0) return null

          return (
            <div key={setor} className="mb-6 avoid-break">
              <h2 className="text-sm font-bold bg-gray-200 p-1.5 mb-0 border border-gray-400 border-b-0 uppercase">
                {setor || 'Geral'}
              </h2>
              <table className="w-full border-collapse border border-gray-400 text-[10px]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-400 p-1 text-left w-32 shrink-0">Nome</th>
                    {days.map(day => (
                      <th key={day.toISOString()} className="border border-gray-400 p-0.5 text-center leading-tight">
                        <div className="font-bold text-[8px]">{format(day, 'E', { locale: ptBR }).substring(0, 1).toUpperCase()}</div>
                        <div>{format(day, 'dd')}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {funcsDoSetor.map(func => (
                    <tr key={func.id} className="hover:bg-gray-50">
                      <td className="border border-gray-400 p-1 font-medium truncate max-w-[120px]">{func.nome}</td>
                      {days.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd')
                        const escalaDia = escalas.find(e => e.funcionario_id === func.id && e.data === dateStr)
                        const letra = escalaDia ? getEscalaLetra(escalaDia.tipo) : ''
                        
                        let cellClass = "border border-gray-400 p-0.5 text-center font-bold"
                        if (letra === 'R') cellClass += " text-green-600 bg-green-50/50 print:bg-transparent"
                        if (letra === 'X') cellClass += " text-blue-700"
                        if (letra === 'F') cellClass += " text-red-600 bg-red-50/50 print:bg-transparent"

                        return (
                          <td key={dateStr} className={cellClass}>
                            {letra}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}

        <div className="mt-6 pt-3 border-t border-gray-300 text-[10px] text-gray-500 flex justify-between">
          <p>Legenda: X=Presente | R=Repouso | F=Falta | J=F. Justif. | A=Atest. | FE=Férias | P=Susp.</p>
          <p>Gerado em: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 5mm; }
          .avoid-break { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
