import React, { useState } from 'react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Printer, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useEscalasPeriodo } from '../hooks/useEscalas'
import { Button } from '../components/ui/Button'
import { Loading } from '../components/ui/Loading'

// Formata para pegar as letras de abreviação da escala
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

export function EscalaSemanalPrint() {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(new Date())

  // Pega segunda a domingo
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 })
  const endDate = endOfWeek(currentDate, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: startDate, end: endDate })

  const { data: funcionarios = [], isLoading: loadF } = useFuncionarios({ status: 'ativo' })
  const { data: escalas = [], isLoading: loadE } = useEscalasPeriodo(
    format(startDate, 'yyyy-MM-dd'),
    format(endDate, 'yyyy-MM-dd')
  )

  const handlePrint = () => {
    window.print()
  }

  if (loadF || loadE) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loading text="Carregando escala semanal..." />
      </div>
    )
  }

  // Agrupar funcionários por setor para melhor visualização
  const setores = Array.from(new Set(funcionarios.map(f => f.setor))).sort()

  return (
    <div className="min-h-screen bg-white text-black print:bg-white print:m-0 print:p-0">
      {/* Controles apenas tela (escondidos na impressão) */}
      <div className="print:hidden p-4 bg-gray-100 border-b flex flex-wrap gap-4 items-center justify-between">
        <Button variant="secondary" onClick={() => navigate('/escala')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>

        <div className="flex items-center gap-4 bg-white rounded-lg p-1 border shadow-sm">
          <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium text-sm">
            {format(startDate, "dd 'de' MMM", { locale: ptBR })} - {format(endDate, "dd 'de' MMM", { locale: ptBR })}
          </span>
          <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <Button onClick={handlePrint} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
          <Printer className="w-4 h-4" />
          Imprimir Escala
        </Button>
      </div>

      {/* Área de Impressão */}
      <div className="p-8 print:p-4 max-w-[297mm] mx-auto bg-white">
        
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold uppercase tracking-wide">Mural de Escala Semanal</h1>
          <p className="text-gray-600 font-medium mt-1">
            Semana: {format(startDate, "dd/MM/yyyy")} a {format(endDate, "dd/MM/yyyy")}
          </p>
        </div>

        {setores.map(setor => {
          const funcsDoSetor = funcionarios.filter(f => f.setor === setor)
          if (funcsDoSetor.length === 0) return null

          return (
            <div key={setor} className="mb-8 avoid-break">
              <h2 className="text-lg font-bold bg-gray-200 p-2 mb-0 border border-gray-400 border-b-0 uppercase">
                {setor}
              </h2>
              <table className="w-full border-collapse border border-gray-400 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-400 p-2 text-left w-1/4">Nome</th>
                    {days.map(day => (
                      <th key={day.toISOString()} className="border border-gray-400 p-2 text-center w-[8%]">
                        <div className="font-bold">{format(day, 'EEEEEE', { locale: ptBR }).toUpperCase()}</div>
                        <div className="text-xs font-normal text-gray-600">{format(day, 'dd/MM')}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {funcsDoSetor.map(func => (
                    <tr key={func.id} className="hover:bg-gray-50">
                      <td className="border border-gray-400 p-2 font-medium">{func.nome}</td>
                      {days.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd')
                        const escalaDia = escalas.find(e => e.funcionario_id === func.id && e.data === dateStr)
                        const letra = escalaDia ? getEscalaLetra(escalaDia.tipo) : ''
                        
                        let cellClass = "border border-gray-400 p-2 text-center font-bold text-base"
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

        <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-500 flex justify-between">
          <p>Legenda: X=Presente | R=Repouso | F=Falta | J=Falta Justificada | A=Atestado | FE=Férias</p>
          <p>Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
        </div>

      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          .avoid-break { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
