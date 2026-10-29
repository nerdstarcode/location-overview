import { useRef, useState, type ChangeEvent } from 'react'
import { Download, Upload } from 'lucide-react'
import { Modal } from '../Modal/Modal'
import { Button } from '../../atoms/Button/Button'
import { exportAllData, importBackup, parseBackup, previewBackup, type ParsedBackup } from '../../../lib/backupStorage'

function formatDateTime(value: string | undefined): string {
  if (!value) return 'data desconhecida'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR')
}

// Exporta/importa tudo o que o app guarda no navegador (cadastros, bases, configuração do Azure
// sem o token e preferências) como um único arquivo JSON. Antes de importar, mostra o que vem
// no arquivo e pede confirmação, porque as seções do arquivo substituem as atuais.
export function DataBackup() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ fileName: string; backup: ParsedBackup } | null>(null)

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
      setPending({ fileName: file.name, backup: parseBackup(JSON.parse(await file.text())) })
      setError(null)
    } catch (cause) {
      const detail = cause instanceof SyntaxError ? 'o arquivo não é um JSON válido' : (cause as Error).message
      setError(`Não foi possível importar: ${detail}`)
    }
  }

  function confirmImport() {
    if (!pending) return
    importBackup(pending.backup)
    // Recarrega a página: cada tela lê seus dados do localStorage só no mount.
    window.location.reload()
  }

  const preview = pending ? previewBackup(pending.backup) : null

  return (
    <div className="flex items-center gap-1">
      <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportChange} />
      <button
        type="button"
        onClick={handleExport}
        aria-label="Exportar dados"
        title="Exportar todos os dados (JSON, sem o token do Azure)"
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

      <Modal
        open={preview !== null}
        onClose={() => setPending(null)}
        title="Importar backup"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmImport}>
              Importar e recarregar
            </Button>
          </>
        }
      >
        {preview && pending && (
          <div className="flex flex-col gap-3 text-sm text-[var(--text)]">
            <p>
              <span className="font-medium text-[var(--text-h)]">{pending.fileName}</span> · exportado em{' '}
              {formatDateTime(preview.exportedAt)} · formato v{preview.version}
            </p>
            <p>As seções abaixo substituem as atuais. O que não está no arquivo continua como está.</p>

            <ul className="flex flex-col divide-y divide-[var(--border)] rounded-md border border-[var(--border)]" aria-label="Conteúdo do backup">
              {preview.sections.map((section) => (
                <li key={section.key} className="flex justify-between px-3 py-1.5">
                  <span className="text-[var(--text-h)]">{section.label}</span>
                  <span>{section.count}</span>
                </li>
              ))}
              {preview.azure && (
                <li className="flex justify-between gap-3 px-3 py-1.5">
                  <span className="text-[var(--text-h)]">Configuração do Azure DevOps</span>
                  <span className="text-right">sem token: o seu token atual é mantido</span>
                </li>
              )}
              {preview.preferences > 0 && (
                <li className="flex justify-between px-3 py-1.5">
                  <span className="text-[var(--text-h)]">Preferências (tema, menu, abas e filtros)</span>
                  <span>{preview.preferences}</span>
                </li>
              )}
            </ul>

            {preview.warnings.length > 0 && (
              <ul className="rounded-r border-l-2 border-brand-action-warning bg-[var(--code-bg)] px-3 py-2 text-xs text-[var(--text-h)]">
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
