// Funcionalidades ainda em validação: aparecem só rodando em localhost (dev server ou preview
// local) e ficam escondidas no ambiente publicado. É só visibilidade — o código continua no bundle.

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export function isLocalhost(hostname = typeof window === 'undefined' ? '' : window.location.hostname): boolean {
  return LOCAL_HOSTNAMES.has(hostname)
}

/** Visão QA das Métricas Individuais (testes executados por pessoa). */
export function canShowQaPersonMetrics(hostname?: string): boolean {
  return isLocalhost(hostname)
}
