import { describe, it, expect } from 'vitest'
import { isTransientError } from './errorClassifier'

describe(`isTransientError`, () => {
  it(`should detect rate limit errors`, () => {
    expect(isTransientError(`Rate limit exceeded`)).toBe(true)
    expect(isTransientError(`429 Too Many Requests`)).toBe(true)
    expect(isTransientError(`too many requests, please slow down`)).toBe(true)
  })

  it(`should detect timeout errors`, () => {
    expect(isTransientError(`Request timed out`)).toBe(true)
    expect(isTransientError(`ETIMEDOUT`)).toBe(true)
    expect(isTransientError(`timeout waiting for response`)).toBe(true)
  })

  it(`should detect network errors`, () => {
    expect(isTransientError(`ECONNRESET`)).toBe(true)
    expect(isTransientError(`ECONNREFUSED`)).toBe(true)
    expect(isTransientError(`socket hang up`)).toBe(true)
    expect(isTransientError(`Network error occurred`)).toBe(true)
  })

  it(`should detect server errors`, () => {
    expect(isTransientError(`503 Service Unavailable`)).toBe(true)
    expect(isTransientError(`502 Bad Gateway`)).toBe(true)
    expect(isTransientError(`Server is overloaded`)).toBe(true)
    expect(isTransientError(`temporarily unavailable`)).toBe(true)
    expect(isTransientError(`internal server error`)).toBe(true)
  })

  it(`should detect retry-suggesting errors`, () => {
    expect(isTransientError(`retry after 30 seconds`)).toBe(true)
    expect(isTransientError(`Please retry your request`)).toBe(true)
  })

  it(`should NOT match generic "retry" in permanent errors`, () => {
    expect(isTransientError(`Do not retry this request`)).toBe(false)
    expect(isTransientError(`Retry limit exceeded permanently`)).toBe(false)
  })

  it(`should NOT detect permanent errors`, () => {
    expect(isTransientError(`Invalid API key`)).toBe(false)
    expect(isTransientError(`Model not found`)).toBe(false)
    expect(isTransientError(`Permission denied`)).toBe(false)
    expect(isTransientError(`Invalid request body`)).toBe(false)
    expect(isTransientError(`Context window exceeded`)).toBe(false)
  })

  it(`should NOT detect context overflow as transient`, () => {
    expect(isTransientError(`prompt is too long: 200000 tokens > 100000 maximum`)).toBe(
      false
    )
    expect(isTransientError(`exceeds the context window`)).toBe(false)
  })
})
