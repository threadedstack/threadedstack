import type { TApp } from '@tdsk/domain'
import { setupErrorHandler } from './setupErrorHandler'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { errorHandler } from '@TBE/utils/errors/errorHandler'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

describe(`setupErrorHandler`, () => {
  let mockUse: ReturnType<typeof vi.fn>
  let mockApp: TApp

  beforeEach(() => {
    vi.clearAllMocks()
    mockUse = vi.fn()
    mockApp = {
      use: mockUse,
    } as unknown as TApp
  })

  it(`should be a function`, () => {
    expect(typeof setupErrorHandler).toBe(`function`)
  })

  it(`should call app.use to register middleware`, () => {
    setupErrorHandler(mockApp)
    expect(mockUse).toHaveBeenCalledOnce()
  })

  it(`should register the errorHandler function on the app`, () => {
    setupErrorHandler(mockApp)
    expect(mockUse).toHaveBeenCalledWith(errorHandler)
  })

  it(`should return void`, () => {
    const result = setupErrorHandler(mockApp)
    expect(result).toBeUndefined()
  })
})
