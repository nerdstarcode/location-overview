import { useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable/DataTable'
import { Modal } from '../../molecules/Modal/Modal'
import { Button } from '../../atoms/Button/Button'
import { Input } from '../../atoms/Input/Input'
import { Select } from '../../atoms/Select/Select'
import { loadSquads, type Squad } from '../../../lib/squadsStorage'
import { formatSprintLabel, loadSprints, type Sprint } from '../../../lib/sprintsStorage'
import {
  DEFAULT_TEST_POINTS_RATIO,
  deleteTestReport,
  loadTestReports,
  upsertTestReport,
  type TestReport,
} from '../../../lib/testReportsStorage'
import { createId } from '../../../lib/createId'

const EMPTY_DRAFT: TestReport = {
  id: '',
  squadId: '',
  sprintId: '',
  testPoints: 0,
  runsPercent: 0,
  passedPercent: 0,
  failedPercent: 0,
  notRunCount: 0,
  pointsRatio: DEFAULT_TEST_POINTS_RATIO,
}

function isValidPercent(value: number): boolean {
  return value >= 0 && value <= 100
}

// Relatórios de teste por squad+sprint: Test Points, Runs/Passed/Failed (%) e
// Not Run Count. Persistido em localStorage via testReportsStorage.ts.
export function TestReportsTable() {
  const [reports, setReports] = useState<TestReport[]>(loadTestReports)
  const [squads] = useState<Squad[]>(loadSquads)
  const [sprints] = useState<Sprint[]>(loadSprints)
  const [draft, setDraft] = useState<TestReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const squadsById = useMemo(() => new Map(squads.map((s) => [s.id, s])), [squads])
  const sprintsById = useMemo(() => new Map(sprints.map((s) => [s.id, s])), [sprints])

  function handleSave() {
    if (!draft) return
    if (!draft.squadId || !draft.sprintId) {
      setError('Squad e Sprint são obrigatórios.')
      return
    }
    if (![draft.runsPercent, draft.passedPercent, draft.failedPercent].every(isValidPercent)) {
      setError('Runs (%), Passed (%) e Failed (%) devem estar entre 0 e 100.')
      return
    }
    if (draft.testPoints < 0 || draft.notRunCount < 0) {
      setError('Test Points e Not Run Count não podem ser negativos.')
      return
    }
    if (draft.pointsRatio <= 0) {
      setError('A proporção Test Points : Story Point deve ser maior que 0.')
      return
    }
    const saved: TestReport = { ...draft, id: draft.id || createId() }
    setReports(upsertTestReport(saved))
    setDraft(null)
    setError(null)
  }

  function handleDelete(id: string) {
    setReports(deleteTestReport(id))
  }

  const columns: ColumnDef<TestReport, unknown>[] = [
    { id: 'squad', header: 'Squad', cell: ({ row }) => squadsById.get(row.original.squadId)?.name ?? '—' },
    {
      id: 'sprint',
      header: 'Sprint',
      cell: ({ row }) => {
        const sprint = sprintsById.get(row.original.sprintId)
        return sprint ? formatSprintLabel(sprint) : '—'
      },
    },
    { accessorKey: 'testPoints', header: 'Test Points', meta: { align: 'right', numeric: true } },
    { accessorKey: 'runsPercent', header: 'Runs (%)', meta: { align: 'right', numeric: true } },
    { accessorKey: 'passedPercent', header: 'Passed (%)', meta: { align: 'right', numeric: true } },
    { accessorKey: 'failedPercent', header: 'Failed (%)', meta: { align: 'right', numeric: true } },
    { accessorKey: 'notRunCount', header: 'Not Run Count', meta: { align: 'right', numeric: true } },
    { accessorKey: 'pointsRatio', header: 'Test Points : Story Point', meta: { align: 'right', numeric: true } },
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
          Relatórios de teste por squad e sprint: Test Points, Runs/Passed/Failed (%) e Not Run Count.
        </p>
        <Button
          type="button"
          onClick={() => {
            setDraft(EMPTY_DRAFT)
            setError(null)
          }}
        >
          Adicionar relatório
        </Button>
      </div>

      <DataTable columns={columns} data={reports} emptyMessage="Nenhum relatório de teste cadastrado." />

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Editar relatório de teste' : 'Adicionar relatório de teste'}
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
              <label className="text-xs text-[var(--text)]">Squad</label>
              <Select
                value={draft.squadId}
                onChange={(e) => setDraft({ ...draft, squadId: e.target.value })}
                placeholder="Selecione uma squad"
                options={squads.map((squad) => ({ value: squad.id, label: squad.name }))}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Sprint</label>
              <Select
                value={draft.sprintId}
                onChange={(e) => setDraft({ ...draft, sprintId: e.target.value })}
                placeholder="Selecione uma sprint"
                options={sprints.map((sprint) => ({ value: sprint.id, label: formatSprintLabel(sprint) }))}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Test Points</label>
              <Input
                type="number"
                min={0}
                value={draft.testPoints}
                onChange={(e) => setDraft({ ...draft, testPoints: Number(e.target.value) })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Runs (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.runsPercent}
                onChange={(e) => setDraft({ ...draft, runsPercent: Number(e.target.value) })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Passed (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.passedPercent}
                onChange={(e) => setDraft({ ...draft, passedPercent: Number(e.target.value) })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Failed (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={draft.failedPercent}
                onChange={(e) => setDraft({ ...draft, failedPercent: Number(e.target.value) })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Not Run Count</label>
              <Input
                type="number"
                min={0}
                value={draft.notRunCount}
                onChange={(e) => setDraft({ ...draft, notRunCount: Number(e.target.value) })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Test Points : Story Point</label>
              <Input
                type="number"
                min={0.1}
                step={0.1}
                value={draft.pointsRatio}
                onChange={(e) => setDraft({ ...draft, pointsRatio: Number(e.target.value) })}
              />
              <p className="text-xs text-[var(--text)]">
                Quantos Test Points equivalem a 1 story point neste relatório (usado no Dashboard).
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
