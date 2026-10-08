import { readList, writeJson } from './localStore'

export interface TestReport {
  id: string
  squadId: string
  sprintId: string
  testPoints: number
  runsPercent: number
  passedPercent: number
  failedPercent: number
  notRunCount: number
  /** Quantos Test Points equivalem a 1 story point neste relatório (editável por relatório). */
  pointsRatio: number
}

/** Valor sugerido ao criar um novo relatório — cada um pode ajustar o seu depois. */
export const DEFAULT_TEST_POINTS_RATIO = 3.5

const STORAGE_KEY = 'location-overview:test-reports'

export function loadTestReports(): TestReport[] {
  return readList<TestReport>(STORAGE_KEY)
}

export function saveTestReports(reports: TestReport[]): void {
  writeJson(STORAGE_KEY, reports)
}

/** Cria (sem id) ou atualiza (com id existente) um relatório de teste. */
export function upsertTestReport(report: TestReport): TestReport[] {
  const reports = loadTestReports()
  const index = reports.findIndex((r) => r.id === report.id)
  const next = index >= 0 ? reports.map((r, i) => (i === index ? report : r)) : [...reports, report]
  saveTestReports(next)
  return next
}

export function deleteTestReport(id: string): TestReport[] {
  const next = loadTestReports().filter((r) => r.id !== id)
  saveTestReports(next)
  return next
}
