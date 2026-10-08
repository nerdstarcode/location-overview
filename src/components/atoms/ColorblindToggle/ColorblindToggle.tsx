import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { getStoredColorblindMode, persistColorblindMode } from '../../../hooks/useColorblindMode'

// Alterna entre a paleta padrão dos gráficos e uma paleta segura para
// daltonismo (azul/laranja + estilo de linha/marcador distintos), escrevendo
// `data-colorblind` no <html> — lido por useColorblindMode().
export function ColorblindToggle() {
  const [enabled, setEnabled] = useState(getStoredColorblindMode)

  useEffect(() => {
    persistColorblindMode(enabled)
  }, [enabled])

  const label = enabled ? 'Desativar visão para daltonismo' : 'Ativar visão para daltonismo'

  return (
    <button
      type="button"
      onClick={() => setEnabled((current) => !current)}
      aria-label={label}
      title={label}
      aria-pressed={enabled}
      className="rounded-full p-2 text-[var(--text)] transition-colors hover:bg-[var(--code-bg)] hover:text-[var(--text-h)] aria-pressed:text-[var(--accent)]"
    >
      {enabled ? <Eye size={18} /> : <EyeOff size={18} />}
    </button>
  )
}
