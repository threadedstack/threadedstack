import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TApp } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock(`@tdsk/database`, () => ({
  database: vi.fn(),
}))

import { setupDatabase } from './setupDatabase'
import { logger } from '@TBE/utils/logger'
import { database } from '@tdsk/database'

const mockDatabase = vi.mocked(database)

describe(`setupDatabase`, () => {
  let mockApp: TApp

  beforeEach(() => {
    vi.clearAllMocks()

    mockApp = {
      locals: {
        config: {},
      },
    } as unknown as TApp

    mockDatabase.mockReturnValue({ services: {} } as any)
  })

  it(`should be a function`, () => {
    expect(typeof setupDatabase).toBe(`function`)
  })

  it(`should log success message after initialization`, () => {
    setupDatabase(mockApp)

    expect(logger.info).toHaveBeenCalledWith(`Database initialized successfully`)
  })

  it(`should log error and re-throw when database initialization fails`, () => {
    const dbError = new Error(`Connection refused`)
    mockDatabase.mockImplementation(() => {
      throw dbError
    })

    expect(() => setupDatabase(mockApp)).toThrow(`Connection refused`)
    expect(logger.error).toHaveBeenCalledWith(`Failed to initialize database:`, dbError)
  })
})
