import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`fs`, () => ({
  readFileSync: vi.fn(),
}))

vi.mock(`@TSB/utils/logger`, () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { readFileSync } from 'fs'
import { logger } from '@TSB/utils/logger'
import { getKubeNS } from './getKubeNS'

describe(`getKubeNS`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`returns the explicit namespace argument immediately, without reading the fs`, () => {
    const result = getKubeNS(`explicit-ns`)

    expect(result).toBe(`explicit-ns`)
    expect(readFileSync).not.toHaveBeenCalled()
  })

  it(`returns the trimmed in-cluster namespace file contents when readFileSync succeeds`, () => {
    vi.mocked(readFileSync).mockReturnValue(`  my-ns\n` as any)

    const result = getKubeNS()

    expect(result).toBe(`my-ns`)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it(`logs an error and falls back to "default" when readFileSync throws`, () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error(`ENOENT`)
    })

    const result = getKubeNS()

    expect(logger.error).toHaveBeenCalledWith(expect.any(String), expect.any(Error))
    expect(logger.warn).toHaveBeenCalled()
    expect(result).toBe(`default`)
  })

  it(`falls back to "default" when readFileSync returns an empty/falsy string`, () => {
    vi.mocked(readFileSync).mockReturnValue(`` as any)

    const result = getKubeNS()

    expect(logger.warn).toHaveBeenCalled()
    expect(result).toBe(`default`)
  })
})
