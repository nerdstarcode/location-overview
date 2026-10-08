import { useEffect, useState } from 'react'

const STORAGE_KEY = 'location-overview:high-contrast-mode'
const ATTRIBUTE = 'data-high-contrast'

function readHighContrastMode(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute(ATTRIBUTE) === 'true'
}

/** Lê `data-high-contrast` no <html>, atualizando sempre que o toggle mudar (ver HighContrastToggle). */
export function useHighContrastMode(): boolean {
  const [enabled, setEnabled] = useState<boolean>(readHighContrastMode)

  useEffect(() => {
    const observer = new MutationObserver(() => setEnabled(readHighContrastMode()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [ATTRIBUTE] })
    return () => observer.disconnect()
  }, [])

  return enabled
}

export function getStoredHighContrastMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY) === 'true'
}

export function persistHighContrastMode(enabled: boolean): void {
  document.documentElement.setAttribute(ATTRIBUTE, String(enabled))
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch {
    /* ignore quota / privacy errors */
  }
}
