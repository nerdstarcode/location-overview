import { describe, expect, it } from 'vitest'
import { findSquadNameForIterationPath, resolveSquadName, squadMatchesIterationPath } from './squadMatching'
import type { Squad } from './squadsStorage'

const RENEWALS: Squad = { id: 'sq1', name: 'Renewals', aliases: ['Renewals Team'] }
const PORTAL: Squad = { id: 'sq2', name: 'Portal' }

describe('squadMatching', () => {
  it('casa o Iteration Path pelo nome principal ou por um alias', () => {
    expect(squadMatchesIterationPath(RENEWALS, 'Renewals\\Sprint 08 - FY26-27')).toBe(true)
    expect(squadMatchesIterationPath(RENEWALS, 'Proj/renewals team/Sprint 08 - FY26-27')).toBe(true)
    expect(squadMatchesIterationPath(PORTAL, 'Renewals Team/Sprint 08')).toBe(false)
  })

  it('devolve sempre o nome principal', () => {
    expect(findSquadNameForIterationPath([PORTAL, RENEWALS], 'Renewals Team/Sprint 08')).toBe('Renewals')
    expect(resolveSquadName([PORTAL, RENEWALS], ' renewals team ')).toBe('Renewals')
    expect(resolveSquadName([PORTAL, RENEWALS], 'Outra')).toBe('Outra')
  })
})
