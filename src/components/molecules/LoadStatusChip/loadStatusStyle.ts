import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Clock, type LucideIcon } from 'lucide-react'
import type { LoadStatus } from '../../../lib/personMetrics'

/** Ícone e cores de cada situação de carga (previsto × máximo × extensão), iguais em todo o app. */
export const LOAD_STATUS_STYLE: Record<LoadStatus, { icon: LucideIcon; text: string; fill: string; dot: string }> = {
  below: { icon: ArrowDown, text: 'text-brand-action-info', fill: 'bg-brand-action-info', dot: 'bg-brand-action-info' },
  within: { icon: CheckCircle2, text: 'text-brand-action-success', fill: 'bg-brand-action-success', dot: 'bg-brand-action-success' },
  above: { icon: ArrowUp, text: 'text-brand-action-warning', fill: 'bg-brand-action-warning', dot: 'bg-brand-action-warning' },
  extension: { icon: Clock, text: 'text-brand-action-alert', fill: 'bg-brand-action-alert', dot: 'bg-brand-action-alert' },
  overload: { icon: AlertTriangle, text: 'text-brand-action-danger', fill: 'bg-brand-action-warning', dot: 'bg-brand-action-danger' },
}
