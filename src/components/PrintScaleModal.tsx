import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Share2 } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'

interface PrintScaleModalProps {
  selectedTeamId?: string | null
}

export function PrintScaleModal({ selectedTeamId }: PrintScaleModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const handlePrintSemanal = () => {
    navigate(`/escala/imprimir-semanal${selectedTeamId ? `?team=${selectedTeamId}` : ''}`)
    setIsOpen(false)
  }

  const handlePrintMensal = () => {
    navigate(`/escala/imprimir-mensal${selectedTeamId ? `?team=${selectedTeamId}` : ''}`)
    setIsOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-3 bg-card border border-border rounded-2xl text-primary shadow-sm hover:shadow-md transition-all active:scale-95 flex-shrink-0"
        title="Compartilhar Escala"
      >
        <Share2 className="w-5 h-5" />
      </button>

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Escolha a Escala para Compartilhar">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Selecione qual formato de escala você deseja compartilhar (Imagem):
          </p>
          
          <div className="flex gap-3">
            <Button
              onClick={handlePrintSemanal}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-all active:scale-95"
            >
              📅 Escala Semanal
            </Button>
            
            <Button
              onClick={handlePrintMensal}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg transition-all active:scale-95"
            >
              📊 Escala Mensal
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
