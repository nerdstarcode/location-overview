export interface DateRange {
  start: string
  end: string
}

/** "2026-09-01T00:00:00Z" → "2026-09-01" (mesmo formato dos inputs type="date"). */
export function toDateKey(value: string): string {
  return value.slice(0, 10)
}

/** "2026-09-01…" → "01/09/2026"; "—" quando não há data. */
export function formatDateBR(value: string | null | undefined): string {
  if (!value) return '—'
  const [year, month, day] = toDateKey(value).split('-')
  return `${day}/${month}/${year}`
}

/** "2026-09-01…" → "01/09" (eixo dos gráficos diários). */
export function formatDayMonth(value: string): string {
  const [, month, day] = toDateKey(value).split('-')
  return `${day}/${month}`
}

function isWeekend(day: Date): boolean {
  const weekday = day.getUTCDay()
  return weekday === 0 || weekday === 6
}

function isWithin(key: string, ranges: DateRange[]): boolean {
  return ranges.some((range) => key >= range.start && key <= range.end)
}

/** Dias úteis (seg–sex) entre as duas datas, inclusive, excluindo `daysOff`, como "yyyy-mm-dd". */
export function workingDaysBetween(startDate: string, endDate: string, daysOff: DateRange[] = []): string[] {
  const offRanges = daysOff.map((range) => ({ start: toDateKey(range.start), end: toDateKey(range.end) }))
  const end = new Date(`${toDateKey(endDate)}T00:00:00Z`)
  const days: string[] = []
  for (let day = new Date(`${toDateKey(startDate)}T00:00:00Z`); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    const key = toDateKey(day.toISOString())
    if (!isWeekend(day) && !isWithin(key, offRanges)) days.push(key)
  }
  return days
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}
