import { describe, it, expect, vi } from 'vitest'

const { mockLoggerInstance, mockBuildApiLogger } = vi.hoisted(() => {
  const mockLoggerInstance = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }
  return {
    mockLoggerInstance,
    mockBuildApiLogger: vi.fn(() => mockLoggerInstance),
  }
})

vi.mock(`@tdsk/logger`, () => ({
  buildApiLogger: mockBuildApiLogger,
}))

vi.mock(`@TPX/configs/proxy.config`, () => ({
  config: {
    logger: {
      label: `TDSK - Proxy`,
      level: `info`,
    },
  },
}))

import { logger } from './logger'

describe(`logger`, () => {
  it(`should be defined`, () => {
    expect(logger).toBeDefined()
  })

  it(`should have an info method`, () => {
    expect(logger.info).toBeTypeOf(`function`)
  })

  it(`should have an error method`, () => {
    expect(logger.error).toBeTypeOf(`function`)
  })

  it(`should have a warn method`, () => {
    expect(logger.warn).toBeTypeOf(`function`)
  })

  it(`should have a debug method`, () => {
    expect(logger.debug).toBeTypeOf(`function`)
  })

  it(`should be created via buildApiLogger`, () => {
    expect(mockBuildApiLogger).toHaveBeenCalledTimes(1)
  })

  it(`should pass the config label to buildApiLogger`, () => {
    expect(mockBuildApiLogger).toHaveBeenCalledWith(`TDSK - Proxy`, `info`)
  })

  it(`should return the logger instance from buildApiLogger`, () => {
    expect(logger).toBe(mockLoggerInstance)
  })
})

describe(`logger usage`, () => {
  it(`should be callable as info without throwing`, () => {
    expect(() => logger.info(`test message`)).not.toThrow()
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(`test message`)
  })

  it(`should be callable as error without throwing`, () => {
    expect(() => logger.error(`error message`)).not.toThrow()
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(`error message`)
  })

  it(`should only call buildApiLogger once at module load`, () => {
    expect(mockBuildApiLogger).toHaveBeenCalledTimes(1)
  })
})
