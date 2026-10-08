import { useState, type FormEvent } from 'react'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { TextField } from '../../molecules/TextField/TextField'
import { Button } from '../../atoms/Button/Button'
import type { AzureConfig } from '../../../lib/azure/azureConfigStorage'

export interface AzureTokenFormProps {
  initialConfig: AzureConfig
  onSave: (config: AzureConfig) => void
  /** Resolve com a quantidade de projetos visíveis para o token. */
  onTest: (config: AzureConfig) => Promise<number>
  onClear?: () => void
}

type Feedback = { kind: 'success' | 'error'; message: string } | null
type Draft = ReturnType<typeof toDraft>

function toDraft(config: AzureConfig) {
  return {
    organization: config.organization,
    pat: config.pat,
    storyPointsField: config.storyPointsField,
    wsjfField: config.wsjfField,
    qaMinPercent: String(config.qaMinPercent),
    qaMaxPercent: String(config.qaMaxPercent),
    pointTypes: config.pointTypes.join(', '),
  }
}

function parsePointTypes(value: string): string[] {
  return value
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean)
}

function isValidQaRange(min: number, max: number): boolean {
  return Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max <= 100 && min <= max
}

function draftToConfig(draft: Draft, fallback: AzureConfig): AzureConfig {
  return {
    organization: draft.organization.trim(),
    pat: draft.pat.trim(),
    storyPointsField: draft.storyPointsField.trim() || fallback.storyPointsField,
    wsjfField: draft.wsjfField.trim() || fallback.wsjfField,
    qaMinPercent: Number(draft.qaMinPercent),
    qaMaxPercent: Number(draft.qaMaxPercent),
    pointTypes: parsePointTypes(draft.pointTypes),
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// Formulário de conexão com o Azure DevOps: organização + PAT e os parâmetros
// usados na análise de sprint (campo de story points, tipos que somam pontos, faixa de QA).
export function AzureTokenForm({ initialConfig, onSave, onTest, onClear }: AzureTokenFormProps) {
  const [draft, setDraft] = useState(() => toDraft(initialConfig))
  const [showPat, setShowPat] = useState(false)
  const [testing, setTesting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const qaRangeInvalid = !isValidQaRange(Number(draft.qaMinPercent), Number(draft.qaMaxPercent))
  const canSubmit = draft.organization.trim() !== '' && draft.pat.trim() !== '' && !qaRangeInvalid
  const buildConfig = () => draftToConfig(draft, initialConfig)

  async function handleTest() {
    setTesting(true)
    setFeedback(null)
    try {
      const count = await onTest(buildConfig())
      setFeedback({ kind: 'success', message: `Conexão ok — ${count} projeto(s) visível(is) para este token.` })
    } catch (error) {
      setFeedback({ kind: 'error', message: errorMessage(error) })
    } finally {
      setTesting(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    onSave(buildConfig())
    setFeedback({ kind: 'success', message: 'Configuração salva.' })
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-2">
      <TextField
        label="Organização"
        value={draft.organization}
        onChange={(e) => setDraft({ ...draft, organization: e.target.value })}
        helperText="Nome em https://dev.azure.com/{organização}"
        autoComplete="off"
        required
      />
      <div className="relative">
        <TextField
          label="Personal Access Token (PAT)"
          type={showPat ? 'text' : 'password'}
          value={draft.pat}
          onChange={(e) => setDraft({ ...draft, pat: e.target.value })}
          helperText="Escopos: Work Items (Read), Project and Team (Read), Test Management (Read). Fica salvo só neste navegador e não vai no backup."
          autoComplete="off"
          required
        />
        <button
          type="button"
          onClick={() => setShowPat((v) => !v)}
          aria-label={showPat ? 'Ocultar token' : 'Mostrar token'}
          className="absolute top-4 right-3 rounded p-1 text-[var(--text)] hover:text-[var(--text-h)]"
        >
          {showPat ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <TextField
        label="Campo de Story Points"
        value={draft.storyPointsField}
        onChange={(e) => setDraft({ ...draft, storyPointsField: e.target.value })}
        helperText="Reference name do campo (Agile: Microsoft.VSTS.Scheduling.StoryPoints)"
      />
      <TextField
        label="Campo de WSJF"
        value={draft.wsjfField}
        onChange={(e) => setDraft({ ...draft, wsjfField: e.target.value })}
        helperText="Reference name do campo customizado. Se não existir, usa qualquer campo terminado em .WSJF"
      />
      <TextField
        label="Tipos que somam Story Points"
        value={draft.pointTypes}
        onChange={(e) => setDraft({ ...draft, pointTypes: e.target.value })}
        helperText="Separados por vírgula. Tasks e Test Cases ficam de fora para não contar em dobro."
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <TextField
          label="QA — mínimo (% da sprint)"
          type="number"
          min={0}
          max={100}
          value={draft.qaMinPercent}
          onChange={(e) => setDraft({ ...draft, qaMinPercent: e.target.value })}
          error={qaRangeInvalid}
        />
        <TextField
          label="QA — máximo (% da sprint)"
          type="number"
          min={0}
          max={100}
          value={draft.qaMaxPercent}
          onChange={(e) => setDraft({ ...draft, qaMaxPercent: e.target.value })}
          error={qaRangeInvalid}
          helperText={qaRangeInvalid ? 'Faixa inválida: use valores de 0 a 100 com mínimo ≤ máximo.' : undefined}
        />
      </div>

      {feedback && (
        <p
          role="status"
          className={`flex items-center gap-2 text-sm ${
            feedback.kind === 'success' ? 'text-[var(--text-h)]' : 'text-brand-action-danger'
          }`}
        >
          {feedback.kind === 'success' && <CheckCircle2 size={16} className="text-brand-action-success" />}
          {feedback.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" disabled={!canSubmit}>
          Salvar
        </Button>
        <Button type="button" variant="secondary" onClick={handleTest} disabled={!canSubmit || testing}>
          {testing ? 'Testando…' : 'Testar conexão'}
        </Button>
        {onClear && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              onClear()
              setDraft(toDraft({ ...initialConfig, organization: '', pat: '' }))
              setFeedback(null)
            }}
          >
            Remover token
          </Button>
        )}
      </div>
    </form>
  )
}
