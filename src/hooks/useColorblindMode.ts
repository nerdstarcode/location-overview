import { useEffect, useState } from 'react'

const STORAGE_KEY = 'location-overview:colorblind-mode'
const ATTRIBUTE = 'data-colorblind'

function readColorblindMode(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute(ATTRIBUTE) === 'true'
}

/** Lê `data-colorblind` no <html>, atualizando sempre que o toggle mudar (ver ColorblindToggle). */
export function useColorblindMode(): boolean {
  const [enabled, setEnabled] = useState<boolean>(readColorblindMode)

  useEffect(() => {
    const observer = new MutationObserver(() => setEnabled(readColorblindMode()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [ATTRIBUTE] })
    return () => observer.disconnect()
  }, [])

  return enabled
}

export function getStoredColorblindMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY) === 'true'
}

export function persistColorblindMode(enabled: boolean): void {
  document.documentElement.setAttribute(ATTRIBUTE, String(enabled))
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch {
    /* ignore quota / privacy errors */
  }
}
