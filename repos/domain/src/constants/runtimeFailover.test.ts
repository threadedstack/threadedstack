import { describe, it, expect } from 'vitest'

import {
  matchTransientSignal,
  isTransientUpstreamFailure,
  CliMaxTransientRetries,
  CliMaxProviderFailovers,
  CliTransientRetryDelaysMs,
  CliSameProviderRetriesBeforeFailover,
} from './runtimeFailover'

describe(`isTransientUpstreamFailure`, () => {
  it(`detects transient upstream signals`, () => {
    for (const text of [
      `API Error: 529 Overloaded`,
      `the model is Overloaded right now`,
      `429 rate limit exceeded`,
      `HTTP 503 Service Unavailable`,
      `got a 502 Bad Gateway`,
      `500 Internal Server Error`,
      `HTTP 504 Gateway Timeout`,
      `{"status":"Failure","message":"Timeout: request did not complete within the allotted timeout","reason":"Timeout","code":504}`,
    ])
      expect(isTransientUpstreamFailure(text)).toBe(true)
  })

  it(`ignores non-transient / empty output`, () => {
    expect(isTransientUpstreamFailure(``)).toBe(false)
    expect(isTransientUpstreamFailure(`Task completed successfully`)).toBe(false)
    // A 402 (billing / out-of-credits) is NOT transient — no failover would help.
    expect(isTransientUpstreamFailure(`402 insufficient credits`)).toBe(false)
  })
})

describe(`matchTransientSignal`, () => {
  it(`returns the matched signal token`, () => {
    expect(matchTransientSignal(`API Error: 529 Overloaded`)).toBe(`API Error: 529`)
    expect(matchTransientSignal(`the model is 529 today`)).toBe(`529`)
    expect(matchTransientSignal(`the model is Overloaded`)).toBe(`Overloaded`)
    expect(matchTransientSignal(`429 rate limit exceeded`)).toBe(`rate limit`)
    expect(matchTransientSignal(`HTTP 503 Service Unavailable`)).toBe(`503`)
    expect(matchTransientSignal(`HTTP 504 Gateway Timeout`)).toBe(`504`)
    expect(matchTransientSignal(`code":504`)).toBe(`504`)
  })

  it(`returns undefined for no match / empty`, () => {
    expect(matchTransientSignal(``)).toBeUndefined()
    expect(matchTransientSignal(`Task completed successfully`)).toBeUndefined()
  })
})

describe(`failover caps`, () => {
  it(`ships sane defaults`, () => {
    expect(CliMaxTransientRetries).toBe(2)
    expect(CliSameProviderRetriesBeforeFailover).toBe(1)
    expect(CliMaxProviderFailovers).toBe(8)
    expect(CliTransientRetryDelaysMs).toEqual([5000, 15000])
  })
})
