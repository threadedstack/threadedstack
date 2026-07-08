import type { TRequest } from '@tdsk/domain'

import { pxToBeHeader } from './pxToBeHeader'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { logger } from '@TBE/utils/logger'

type TBuildOpts = {
  environment?: string
  headerKey?: string
  headerValue?: string
  headers?: Record<string, string>
}

const buildReq = ({
  environment,
  headerKey = `tdsk-backend`,
  headerValue,
  headers = {},
}: TBuildOpts = {}) =>
  ({
    header: (key: string) => headers[key],
    app: {
      locals: {
        config: {
          server: { environment },
          proxy: { headerKey, headerValue },
        },
      },
    },
  }) as unknown as TRequest

beforeEach(() => {
  vi.clearAllMocks()
})

describe(`pxToBeHeader`, () => {
  it(`passes when the configured header value matches`, () => {
    const req = buildReq({
      environment: `production`,
      headerValue: `secret-value`,
      headers: { 'tdsk-backend': `secret-value` },
    })
    expect(() => pxToBeHeader(req)).not.toThrow()
  })

  it(`rejects when the header is missing`, () => {
    const req = buildReq({ environment: `production`, headerValue: `secret-value` })
    expect(() => pxToBeHeader(req)).toThrow(`Invalid proxy validation`)
  })

  it(`rejects when the header value does not match`, () => {
    const req = buildReq({
      environment: `production`,
      headerValue: `secret-value`,
      headers: { 'tdsk-backend': `wrong-value` },
    })
    expect(() => pxToBeHeader(req)).toThrow(`Invalid proxy validation`)
  })

  it(`FAILS CLOSED in production when no header value is configured`, () => {
    const req = buildReq({ environment: `production`, headerValue: undefined })
    expect(() => pxToBeHeader(req)).toThrow(`Invalid proxy validation`)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(`SECURITY`))
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(`TDSK_BE_HEADER_VALUE`)
    )
  })

  it(`FAILS CLOSED when NODE_ENV is not set at all (unknown = untrusted)`, () => {
    const req = buildReq({ environment: undefined, headerValue: undefined })
    expect(() => pxToBeHeader(req)).toThrow(`Invalid proxy validation`)
    expect(logger.error).toHaveBeenCalled()
  })

  it(`allows a missing header value ONLY in an explicit local env`, () => {
    const req = buildReq({ environment: `local`, headerValue: undefined })
    expect(() => pxToBeHeader(req)).not.toThrow()
  })

  it(`allows a missing header value ONLY in an explicit test env`, () => {
    const req = buildReq({ environment: `test`, headerValue: undefined })
    expect(() => pxToBeHeader(req)).not.toThrow()
  })

  it(`still validates the header in local when a value IS configured`, () => {
    const req = buildReq({
      environment: `local`,
      headerValue: `secret-value`,
      headers: { 'tdsk-backend': `wrong-value` },
    })
    expect(() => pxToBeHeader(req)).toThrow(`Invalid proxy validation`)
  })
})
