import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable/DataTable'
import { Modal } from '../../molecules/Modal/Modal'
import { Button } from '../../atoms/Button/Button'
import { Input } from '../../atoms/Input/Input'
import { Select } from '../../atoms/Select/Select'
import { CARGO_SUGGESTIONS } from '../../../lib/peopleStorage'
import { loadLevels, type LevelConfig } from '../../../lib/levelsStorage'
import { CARGO_TIPOS, deleteCargo, loadCargos, upsertCargo, type CargoConfig } from '../../../lib/cargosStorage'
import { createId } from '../../../lib/createId'

const EMPTY_DRAFT: CargoConfig = { id: '', cargo: '', tipo: 'Dev', nivel: '' }

// Catálogo de cargos: relaciona o nome do Cargo a um Tipo (Dev/QA/Dados/Gestão)
// e a uma Senioridade (o mesmo Nível cadastrado em Níveis). Persistido em
// localStorage via cargosStorage.ts.
export function CargosTable() {
  const [cargos, setCargos] = useState<CargoConfig[]>(loadCargos)
  const [levels] = useState<LevelConfig[]>(loadLevels)
  const [draft, setDraft] = useState<CargoConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    if (!draft) return
    if (!draft.cargo.trim()) {
      setError('Cargo é obrigatório.')
      return
    }
    if (!draft.nivel) {
      setError('Senioridade é obrigatória.')
      return
    }
    const saved: CargoConfig = { ...draft, id: draft.id || createId(), cargo: draft.cargo.trim() }
    setCargos(upsertCargo(saved))
    setDraft(null)
    setError(null)
  }

  function handleDelete(id: string) {
    setCargos(deleteCargo(id))
  }

  const columns: ColumnDef<CargoConfig, unknown>[] = [
    { accessorKey: 'cargo', header: 'Cargo' },
    { accessorKey: 'tipo', header: 'Tipo' },
    { accessorKey: 'nivel', header: 'Senioridade' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setDraft(row.original)
              setError(null)
            }}
            aria-label="Editar"
            className="rounded p-1 text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(row.original.id)}
            aria-label="Excluir"
            className="rounded p-1 text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-brand-action-danger"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text)]">
          Cadastro de cargos: relaciona o Cargo a um Tipo (Dev/QA/Dados/Gestão) e a uma Senioridade.
        </p>
        <Button
          type="button"
          onClick={() => {
            setDraft(EMPTY_DRAFT)
            setError(null)
          }}
        >
          Adicionar cargo
        </Button>
      </div>

      <DataTable columns={columns} data={cargos} emptyMessage="Nenhum cargo cadastrado." />

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Editar cargo' : 'Adicionar cargo'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave}>
              Salvar
            </Button>
          </>
        }
      >
        {draft && (
          <div className="flex flex-col gap-4">
            {error && <p className="text-sm text-brand-action-danger">{error}</p>}

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Cargo</label>
              <Input value={draft.cargo} onChange={(e) => setDraft({ ...draft, cargo: e.target.value })} list="cargo-suggestions" />
              <datalist id="cargo-suggestions">
                {CARGO_SUGGESTIONS.map((cargo) => (
                  <option key={cargo} value={cargo} />
                ))}
              </datalist>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Tipo</label>
              <Select
                value={draft.tipo}
                onChange={(e) => setDraft({ ...draft, tipo: e.target.value as CargoConfig['tipo'] })}
                options={CARGO_TIPOS.map((tipo) => ({ value: tipo, label: tipo }))}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Senioridade</label>
              <Select
                value={draft.nivel}
                onChange={(e) => setDraft({ ...draft, nivel: e.target.value })}
                placeholder="Selecione uma senioridade"
                options={levels.map((level) => ({ value: level.nivel, label: `${level.nivel} — ${level.label}` }))}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
