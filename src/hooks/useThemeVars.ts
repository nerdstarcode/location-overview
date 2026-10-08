import { useEffect, useState } from 'react'

export interface ThemeVars {
  text: string
  textH: string
  border: string
  bgElevated: string
  accent: string
  /** true quando o tema efetivo é escuro — `data-theme="dark"` explícito, ou o padrão do sistema sem escolha manual. */
  isDark: boolean
}

function readIsDark(): boolean {
  const explicit = document.documentElement.getAttribute('data-theme')
  if (explicit === 'light' || explicit === 'dark') return explicit === 'dark'
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readThemeVars(): ThemeVars {
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string) => styles.getPropertyValue(name).trim()
  return {
    text: read('--text'),
    textH: read('--text-h'),
    border: read('--border'),
    bgElevated: read('--bg-elevated'),
    accent: read('--accent'),
    isDark: readIsDark(),
  }
}

// Resolve os tokens de tema (index.css) para valores concretos, atualizando
// sempre que o toggle claro/escuro muda `data-theme` no <html> — necessário
// porque bibliotecas de canvas (echarts) não entendem var(--x) diretamente.
export function useThemeVars(): ThemeVars {
  const [vars, setVars] = useState<ThemeVars>(() => (typeof window === 'undefined' ? ({} as ThemeVars) : readThemeVars()))

  useEffect(() => {
    const observer = new MutationObserver(() => setVars(readThemeVars()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  return vars
}
