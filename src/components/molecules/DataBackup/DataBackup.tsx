import { useRef, useState, type ChangeEvent } from 'react'
import { Download, Upload } from 'lucide-react'
import { exportAllData, importAllData } from '../../../lib/backupStorage'

// Exporta/importa todos os dados da aplicação (Alocação, Work Items, Níveis,
// Pessoas, Squads, Sprints, Alocações de pessoas) como um único arquivo JSON.
export function DataBackup() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  function handleExport() {
    const backup = exportAllData()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `location-overview-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const text = await file.text()
      importAllData(JSON.parse(text))
      setError(null)
      // Recarrega a página: cada tela lê seus dados do localStorage só no mount.
      window.location.reload()
    } catch {
      setError('Não foi possível importar. Verifique se o arquivo é um JSON de backup válido.')
    }
  }

  return (
    <div className="flex items-center gap-1">
      <input ref={inputRef} type="file" accept="application/json" className="hidden" onChange={handleImportChange} />
      <button
        type="button"
        onClick={handleExport}
        aria-label="Exportar dados"
        title="Exportar todos os dados (JSON)"
        className="rounded-md p-1.5 text-[var(--text)] transition-colors hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]"
      >
        <Download size={18} />
      </button>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Importar dados"
        title="Importar dados (JSON)"
        className="rounded-md p-1.5 text-[var(--text)] transition-colors hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]"
      >
        <Upload size={18} />
      </button>
      {error && <span className="text-xs text-brand-action-danger">{error}</span>}
    </div>
  )
}
