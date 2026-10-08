import { useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable/DataTable'
import { Modal } from '../../molecules/Modal/Modal'
import { MultiSelectFilter } from '../../molecules/MultiSelectFilter/MultiSelectFilter'
import { Button } from '../../atoms/Button/Button'
import { Input } from '../../atoms/Input/Input'
import { Select } from '../../atoms/Select/Select'
import { Chip } from '../../atoms/Chip/Chip'
import { loadLevels } from '../../../lib/levelsStorage'
import { loadSquads } from '../../../lib/squadsStorage'
import { loadCargos } from '../../../lib/cargosStorage'
import { deletePerson, loadPeople, upsertPerson, type Person } from '../../../lib/peopleStorage'
import { createId } from '../../../lib/createId'

const EMPTY_DRAFT: Person = { id: '', nome: '', email: '', cargo: '', nivel: '', squadIds: [] }

// Cadastro de pessoas (Nome/Email/Cargo/Nível/Squads), persistido em localStorage
// via peopleStorage.ts. Nível vem das opções cadastradas em Níveis; Squads vem
// do cadastro de Squads — o vínculo pessoa↔squad vive em Person.squadIds.
export function PeopleTable() {
  const [people, setPeople] = useState<Person[]>(loadPeople)
  const [squads] = useState(loadSquads)
  const [levels] = useState(loadLevels)
  const [cargos] = useState(loadCargos)
  const [draft, setDraft] = useState<Person | null>(null)
  const [error, setError] = useState<string | null>(null)

  const squadNameById = useMemo(() => new Map(squads.map((squad) => [squad.id, squad.name])), [squads])
  const squadIdByName = useMemo(() => new Map(squads.map((squad) => [squad.name, squad.id])), [squads])
  const cargoByName = useMemo(() => new Map(cargos.map((cargo) => [cargo.cargo, cargo])), [cargos])

  function handleSave() {
    if (!draft) return
    if (!draft.nome.trim() || !draft.email.trim()) {
      setError('Nome e Email são obrigatórios.')
      return
    }
    const saved: Person = { ...draft, id: draft.id || createId(), nome: draft.nome.trim(), email: draft.email.trim() }
    setPeople(upsertPerson(saved))
    setDraft(null)
    setError(null)
  }

  function handleDelete(id: string) {
    setPeople(deletePerson(id))
  }

  const columns: ColumnDef<Person, unknown>[] = [
    { accessorKey: 'nome', header: 'Nome' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'cargo', header: 'Cargo' },
    { accessorKey: 'nivel', header: 'Nível' },
    {
      accessorKey: 'squadIds',
      header: 'Squads',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.squadIds.map((id) => (
            <Chip key={id} label={squadNameById.get(id) ?? id} />
          ))}
        </div>
      ),
    },
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
        <p className="text-sm text-[var(--text)]">Cadastro de pessoas: Nome, Email, Cargo, Nível e Squads.</p>
        <Button
          type="button"
          onClick={() => {
            setDraft(EMPTY_DRAFT)
            setError(null)
          }}
        >
          Adicionar pessoa
        </Button>
      </div>

      <DataTable columns={columns} data={people} emptyMessage="Nenhuma pessoa cadastrada." />

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Editar pessoa' : 'Adicionar pessoa'}
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
              <label className="text-xs text-[var(--text)]">Nome</label>
              <Input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Email</label>
              <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Cargo</label>
              {cargos.length === 0 ? (
                <p className="text-sm text-[var(--text)]">
                  Nenhum cargo cadastrado ainda — cadastre em Níveis → Cargos.
                </p>
              ) : (
                <Select
                  value={draft.cargo}
                  onChange={(e) => {
                    const cargoName = e.target.value
                    const cargo = cargoByName.get(cargoName)
                    setDraft({ ...draft, cargo: cargoName, nivel: cargo?.nivel ?? draft.nivel })
                  }}
                  placeholder="Selecione um cargo"
                  options={cargos.map((cargo) => ({ value: cargo.cargo, label: `${cargo.cargo} (${cargo.tipo})` }))}
                />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Nível</label>
              <p className="text-sm text-[var(--text-h)]">
                {draft.nivel
                  ? `${draft.nivel} — ${levels.find((l) => l.nivel === draft.nivel)?.label ?? ''} (definido pelo cargo)`
                  : 'Selecione um cargo para definir o nível.'}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Squads</label>
              <MultiSelectFilter
                label="Squads"
                options={squads.map((squad) => squad.name)}
                selected={draft.squadIds.map((id) => squadNameById.get(id) ?? id)}
                onChange={(names) =>
                  setDraft({ ...draft, squadIds: names.map((name) => squadIdByName.get(name) ?? name) })
                }
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
