import { useEffect, useState } from 'react'
import { Contrast } from 'lucide-react'
import { getStoredHighContrastMode, persistHighContrastMode } from '../../../hooks/useHighContrastMode'

// Alterna um tema de alto contraste (texto/fundo/bordas mais extremos, cores
// dos gráficos mais saturadas) escrevendo `data-high-contrast` no <html> —
// lido por useHighContrastMode() e pelos tokens de index.css.
export function HighContrastToggle() {
  const [enabled, setEnabled] = useState(getStoredHighContrastMode)

  useEffect(() => {
    persistHighContrastMode(enabled)
  }, [enabled])

  const label = enabled ? 'Desativar alto contraste' : 'Ativar alto contraste'

  return (
    <button
      type="button"
      onClick={() => setEnabled((current) => !current)}
      aria-label={label}
      title={label}
      aria-pressed={enabled}
      className="rounded-full p-2 text-[var(--text)] transition-colors hover:bg-[var(--code-bg)] hover:text-[var(--text-h)] aria-pressed:text-[var(--accent)]"
    >
      <Contrast size={18} />
    </button>
  )
}
