import { readList, writeJson } from './localStore'

export interface LevelConfig {
  nivel: string
  label: string
  capacityPointsDay: number
  maxPointsDay: number
}

const STORAGE_KEY = 'location-overview:levels'

// Mesmos valores usados originalmente em src/lib/allocation.tsx (MIN/MAX_POINTS_PER_DAY).
export const DEFAULT_LEVELS: LevelConfig[] = [
  { nivel: 'APR', label: 'Aprendiz', capacityPointsDay: 0, maxPointsDay: 0 },
  { nivel: 'ES', label: 'Estagiário', capacityPointsDay: 0.2, maxPointsDay: 0.5 },
  { nivel: 'JR', label: 'Júnior', capacityPointsDay: 0.5, maxPointsDay: 1 },
  { nivel: 'PL', label: 'Pleno', capacityPointsDay: 1, maxPointsDay: 1.5 },
  { nivel: 'SR', label: 'Sênior', capacityPointsDay: 1.5, maxPointsDay: 2 },
]

/** Dados antigos (antes do rename Min -> Capacity) ainda podem ter `minPointsDay` salvo no localStorage. */
function migrateLevel(raw: unknown): LevelConfig {
  const level = raw as Partial<LevelConfig> & { minPointsDay?: number }
  return {
    nivel: level.nivel ?? '',
    label: level.label ?? '',
    capacityPointsDay: level.capacityPointsDay ?? level.minPointsDay ?? 0,
    maxPointsDay: level.maxPointsDay ?? 0,
  }
}

export function loadLevels(): LevelConfig[] {
  const stored = readList<unknown>(STORAGE_KEY)
  return stored.length > 0 ? stored.map(migrateLevel) : DEFAULT_LEVELS
}

export function saveLevels(levels: LevelConfig[]): void {
  writeJson(STORAGE_KEY, levels)
}

/** Índice nivel (ex.: "SR") -> capacity/max points/day, para uso na importação/derivação. */
export function levelsToPointsMap(levels: LevelConfig[]): Record<string, { capacity: number; max: number }> {
  const map: Record<string, { capacity: number; max: number }> = {}
  for (const level of levels) {
    map[level.nivel.trim().toUpperCase()] = { capacity: level.capacityPointsDay, max: level.maxPointsDay }
  }
  return map
}
