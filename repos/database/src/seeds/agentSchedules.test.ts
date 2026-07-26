import { describe, it, expect } from 'vitest'
import { ContextSourceInjectMaxChars } from '@tdsk/domain'

import {
  BoardPlansSource,
  BoardStrategySource,
  BoardPositionsSource,
  BoardOpenDecisionsSource,
} from '@TDB/seeds/agentSchedules'

describe(`board context-source max caps`, () => {
  it.each([
    [`BoardStrategySource`, BoardStrategySource],
    [`BoardOpenDecisionsSource`, BoardOpenDecisionsSource],
    [`BoardPositionsSource`, BoardPositionsSource],
    [`BoardPlansSource`, BoardPlansSource],
  ])(
    `%s sets an explicit max above the untuned ContextSourceInjectMaxChars default`,
    (_name, source) => {
      expect(typeof source.max).toBe(`number`)
      expect(source.max).toBeGreaterThan(ContextSourceInjectMaxChars)
    }
  )
})
