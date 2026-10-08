import { readList, writeJson } from './localStore'

export const CARGO_TIPOS = ['Dev', 'QA', 'Dados', 'Gestão'] as const
export type CargoTipo = (typeof CARGO_TIPOS)[number]

export interface CargoConfig {
  id: string
  cargo: string
  tipo: CargoTipo
  nivel: string
}

const STORAGE_KEY = 'location-overview:cargos'

export function loadCargos(): CargoConfig[] {
  return readList<CargoConfig>(STORAGE_KEY)
}

export function saveCargos(cargos: CargoConfig[]): void {
  writeJson(STORAGE_KEY, cargos)
}

/** Cria (sem id) ou atualiza (com id existente) um cargo, mantendo a lista ordenada pelo nome do cargo. */
export function upsertCargo(cargo: CargoConfig): CargoConfig[] {
  const cargos = loadCargos()
  const index = cargos.findIndex((c) => c.id === cargo.id)
  const next = index >= 0 ? cargos.map((c, i) => (i === index ? cargo : c)) : [...cargos, cargo]
  next.sort((a, b) => a.cargo.localeCompare(b.cargo))
  saveCargos(next)
  return next
}

export function deleteCargo(id: string): CargoConfig[] {
  const next = loadCargos().filter((c) => c.id !== id)
  saveCargos(next)
  return next
}
