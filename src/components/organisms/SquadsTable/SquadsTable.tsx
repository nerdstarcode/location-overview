import { useMemo, useState } from 'react'
import { GitMerge, Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable/DataTable'
import { Modal } from '../../molecules/Modal/Modal'
import { MultiSelectFilter } from '../../molecules/MultiSelectFilter/MultiSelectFilter'
import { Button } from '../../atoms/Button/Button'
import { Input } from '../../atoms/Input/Input'
import { Select } from '../../atoms/Select/Select'
import { Chip } from '../../atoms/Chip/Chip'
import { loadPeople, setSquadMembers, type Person } from '../../../lib/peopleStorage'
import { deleteSquad, loadSquads, upsertSquad, type Squad } from '../../../lib/squadsStorage'
import { squadMatchesName } from '../../../lib/squadMatching'
import { dedupeAliases, mergeSquads } from '../../../lib/squadMerge'
import { createId } from '../../../lib/createId'

interface SquadDraft {
  id: string
  name: string
  /** Nomes alternativos separados por vírgula, como digitados no campo. */
  aliases: string
  memberIds: string[]
}

interface MergeDraft {
  source: Squad
  targetId: string
}

const EMPTY_DRAFT: SquadDraft = { id: '', name: '', aliases: '', memberIds: [] }

// Cadastro de squads + vínculo de pessoas. O vínculo é editado aqui mas a
// fonte de verdade continua sendo Person.squadIds (ver peopleStorage.setSquadMembers).
// Nomes alternativos (aliases) fazem a squad ser reconhecida por outros nomes
// em todo o app (Iteration Path, Team do Azure, planilha de alocação).
export function SquadsTable() {
  const [squads, setSquads] = useState<Squad[]>(loadSquads)
  const [people, setPeople] = useState<Person[]>(loadPeople)
  const [draft, setDraft] = useState<SquadDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mergeDraft, setMergeDraft] = useState<MergeDraft | null>(null)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [mergeSummary, setMergeSummary] = useState<string | null>(null)

  const nameById = useMemo(() => new Map(people.map((person) => [person.id, person.nome])), [people])
  const idByName = useMemo(() => new Map(people.map((person) => [person.nome, person.id])), [people])

  function membersOf(squadId: string): Person[] {
    return people.filter((person) => person.squadIds.includes(squadId))
  }

  function handleSave() {
    if (!draft) return
    const name = draft.name.trim()
    if (!name) {
      setError('Nome é obrigatório.')
      return
    }
    const aliases = dedupeAliases(name, draft.aliases.split(','))
    for (const candidate of [name, ...aliases]) {
      const owner = squads.find((squad) => squad.id !== draft.id && squadMatchesName(squad, candidate))
      if (owner) {
        setError(`"${candidate}" já é nome da squad ${owner.name}. Use "Mesclar" para juntar as duas.`)
        return
      }
    }
    const id = draft.id || createId()
    const nextSquads = upsertSquad({ id, name, ...(aliases.length > 0 && { aliases }) })
    const nextPeople = setSquadMembers(id, draft.memberIds)
    setSquads(nextSquads)
    setPeople(nextPeople)
    setDraft(null)
    setError(null)
  }

  function handleDelete(id: string) {
    setSquads(deleteSquad(id))
    setPeople(setSquadMembers(id, []))
  }

  function handleMerge() {
    if (!mergeDraft) return
    const target = squads.find((squad) => squad.id === mergeDraft.targetId)
    if (!target) {
      setMergeError('Selecione a squad principal.')
      return
    }
    const result = mergeSquads(mergeDraft.source.id, target.id)
    setSquads(loadSquads())
    setPeople(loadPeople())
    const discarded = result.allocationsDiscarded + result.testReportsDiscarded
    setMergeSummary(
      `${mergeDraft.source.name} mesclada em ${target.name}: ${result.allocationsMoved} alocações e ` +
        `${result.testReportsMoved} relatórios de teste movidos` +
        (discarded > 0
          ? `; ${result.allocationsDiscarded} alocações e ${result.testReportsDiscarded} relatórios descartados por já existirem em ${target.name}.`
          : '.'),
    )
    setMergeDraft(null)
    setMergeError(null)
  }

  const columns: ColumnDef<Squad, unknown>[] = [
    { accessorKey: 'name', header: 'Nome' },
    {
      id: 'aliases',
      header: 'Nomes alternativos',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {(row.original.aliases ?? []).map((alias) => (
            <Chip key={alias} label={alias} />
          ))}
        </div>
      ),
    },
    {
      id: 'members',
      header: 'Membros',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {membersOf(row.original.id).map((person) => (
            <Chip key={person.id} label={person.nome} />
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
              setDraft({
                id: row.original.id,
                name: row.original.name,
                aliases: (row.original.aliases ?? []).join(', '),
                memberIds: membersOf(row.original.id).map((p) => p.id),
              })
              setError(null)
            }}
            aria-label="Editar"
            className="rounded p-1 text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              setMergeDraft({ source: row.original, targetId: '' })
              setMergeError(null)
            }}
            aria-label="Mesclar em outra squad"
            title="Mesclar em outra squad"
            className="rounded p-1 text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]"
          >
            <GitMerge size={14} />
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
        <p className="text-sm text-[var(--text)]">Cadastro de squads e vínculo de pessoas.</p>
        <Button
          type="button"
          onClick={() => {
            setDraft(EMPTY_DRAFT)
            setError(null)
          }}
        >
          Adicionar squad
        </Button>
      </div>

      {mergeSummary && <p className="text-sm text-[var(--text)]">{mergeSummary}</p>}

      <DataTable columns={columns} data={squads} emptyMessage="Nenhuma squad cadastrada." />

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Editar squad' : 'Adicionar squad'}
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
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Nomes alternativos (separados por vírgula)</label>
              <Input
                value={draft.aliases}
                placeholder="Ex.: Renewals Team"
                onChange={(e) => setDraft({ ...draft, aliases: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Membros</label>
              <MultiSelectFilter
                label="Membros"
                options={people.map((person) => person.nome)}
                selected={draft.memberIds.map((id) => nameById.get(id) ?? id)}
                onChange={(names) => setDraft({ ...draft, memberIds: names.map((name) => idByName.get(name) ?? name) })}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={mergeDraft !== null}
        onClose={() => setMergeDraft(null)}
        title={mergeDraft ? `Mesclar ${mergeDraft.source.name}` : 'Mesclar squad'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setMergeDraft(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleMerge}>
              Mesclar
            </Button>
          </>
        }
      >
        {mergeDraft && (
          <div className="flex flex-col gap-4">
            {mergeError && <p className="text-sm text-brand-action-danger">{mergeError}</p>}
            <p className="text-sm text-[var(--text)]">
              {mergeDraft.source.name} deixa de existir e vira nome alternativo da squad escolhida. Alocações, relatórios
              de teste e membros passam para ela — se já houver alocação da mesma pessoa na mesma sprint (ou relatório
              da mesma sprint), vale o da squad principal.
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Squad principal</label>
              <Select
                value={mergeDraft.targetId}
                onChange={(e) => setMergeDraft({ ...mergeDraft, targetId: e.target.value })}
                placeholder="Selecione uma squad"
                options={squads
                  .filter((squad) => squad.id !== mergeDraft.source.id)
                  .map((squad) => ({ value: squad.id, label: squad.name }))}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
