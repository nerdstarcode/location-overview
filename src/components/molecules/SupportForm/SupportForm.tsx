import { useState, type FormEvent } from 'react'
import { ArrowLeftRight, Plus } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '../../atoms/Button/Button'
import { COMPACT_FIELD_CLASSES } from '../../atoms/Input/compactFieldClasses'
import { Select } from '../../atoms/Select/Select'
import { isQaPerson } from '../../../lib/azure/sprintMetrics'
import type { CargoConfig } from '../../../lib/cargosStorage'
import type { Person } from '../../../lib/peopleStorage'
import { SUPPORT_PRESETS, type SupportDraft } from '../../../lib/personSupportsStorage'

export interface SupportFormProps {
  /** Quem pode entrar no apoio: as pessoas alocadas na sprint. */
  people: Person[]
  cargos: CargoConfig[]
  initialSupporterId?: string
  /** Devolve a mensagem de erro, ou null quando gravou (o formulário então limpa o apoiado). */
  onSubmit: (draft: Omit<SupportDraft, 'sprintId'>) => string | null
}

const DEFAULT_PERCENTAGE = SUPPORT_PRESETS[1].percentage
const fieldLabel = 'text-xs text-[var(--text)]'

// Cadastro rápido de um apoio: quem apoia → quem é apoiado (só do mesmo tipo, QA ou não-QA),
// a % com os atalhos Leve/Médio/Intenso e Enter para gravar.
export function SupportForm({ people, cargos, initialSupporterId = '', onSubmit }: SupportFormProps) {
  const [supporterId, setSupporterId] = useState(initialSupporterId)
  const [supportedId, setSupportedId] = useState('')
  const [percentage, setPercentage] = useState(DEFAULT_PERCENTAGE)
  const [error, setError] = useState<string | null>(null)

  const sorted = [...people].sort((a, b) => a.nome.localeCompare(b.nome))
  const supporter = people.find((p) => p.id === supporterId)
  const supportedOptions = sorted.filter(
    (p) => p.id !== supporterId && (!supporter || isQaPerson(p, cargos) === isQaPerson(supporter, cargos)),
  )

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const message = onSubmit({ supporterId, supportedId, percentage })
    setError(message)
    if (message === null) setSupportedId('')
  }

  function swap() {
    setSupporterId(supportedId)
    setSupportedId(supporterId)
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Adicionar apoio" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <label className={fieldLabel}>Quem apoia</label>
          <Select
            size="sm"
            aria-label="Quem apoia"
            value={supporterId}
            onChange={(value) => {
              setSupporterId(value)
              if (value === supportedId) setSupportedId('')
            }}
            placeholder="Escolha quem apoia"
            noOptionsText="Ninguém alocado nesta sprint"
            options={sorted.map((p) => ({ value: p.id, label: p.nome }))}
          />
        </div>
        <button
          type="button"
          onClick={swap}
          aria-label="Inverter quem apoia e quem é apoiado"
          title="Inverter"
          className="mb-1 rounded-md p-2 text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]"
        >
          <ArrowLeftRight size={16} />
        </button>
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <label className={fieldLabel}>Apoiado</label>
          <Select
            size="sm"
            aria-label="Quem é apoiado"
            value={supportedId}
            onChange={setSupportedId}
            placeholder="Escolha quem é apoiado"
            noOptionsText="Ninguém do mesmo tipo (QA ou não-QA) alocado"
            options={supportedOptions.map((p) => ({ value: p.id, label: p.nome }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={fieldLabel}>% do apoiado</label>
          <input
            type="number"
            min={1}
            max={100}
            aria-label="% do apoio"
            value={percentage}
            onChange={(e) => setPercentage(Number(e.target.value))}
            className={`${COMPACT_FIELD_CLASSES} w-24 text-right`}
          />
        </div>
        <div className="flex gap-1" role="group" aria-label="Intensidade">
          {SUPPORT_PRESETS.map((preset) => (
            <button
              key={preset.percentage}
              type="button"
              aria-pressed={percentage === preset.percentage}
              onClick={() => setPercentage(preset.percentage)}
              className={clsx(
                'h-10 rounded-md border px-2 text-xs transition-colors',
                percentage === preset.percentage
                  ? 'border-blue-500 bg-blue-500/10 text-[var(--text-h)]'
                  : 'border-[var(--border)] text-[var(--text)] hover:text-[var(--text-h)]',
              )}
            >
              {preset.label} {preset.percentage}%
            </button>
          ))}
        </div>
        <Button type="submit" className="h-10" disabled={!supporterId || !supportedId}>
          <Plus size={14} /> Adicionar apoio
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-brand-action-danger">
          {error}
        </p>
      )}
    </form>
  )
}
