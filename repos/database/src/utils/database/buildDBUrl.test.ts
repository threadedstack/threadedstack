import { describe, it, expect } from 'vitest'
import { buildDBUrl } from './buildDBUrl'

describe(`buildDBUrl`, () => {
  it(`should pass through a full URL`, () => {
    const result = buildDBUrl({ url: `postgresql://user:pass@localhost:5432/mydb` })
    expect(result).toBe(`postgresql://user:pass@localhost:5432/mydb`)
  })

  it(`should add default postgresql protocol when URL has no proto`, () => {
    const result = buildDBUrl({ url: `localhost:5432/mydb` })
    expect(result).toContain(`postgresql://`)
    expect(result).toContain(`localhost`)
  })

  it(`should override URL proto with custom proto option`, () => {
    const result = buildDBUrl({ url: `mysql://localhost:5432/mydb`, proto: `postgresql` })
    expect(result).toContain(`postgresql://`)
    expect(result).not.toContain(`mysql://`)
  })

  it(`should build correct URL from host only`, () => {
    const result = buildDBUrl({ host: `localhost:5432` })
    expect(result).toContain(`postgresql://localhost:5432`)
  })

  it(`should throw when both url and host are missing`, () => {
    expect(() => buildDBUrl({})).toThrow(
      `Can not build DB connection string, either a "url" or "host" must be provided`
    )
  })

  it(`should add username and password when not already in the URL`, () => {
    const result = buildDBUrl({
      url: `postgresql://localhost:5432`,
      user: `admin`,
      pass: `secret`,
    })
    expect(result).toContain(`admin`)
    expect(result).toContain(`secret`)
  })

  it(`should not override existing username and password in the URL`, () => {
    const result = buildDBUrl({
      url: `postgresql://existing:creds@localhost:5432`,
      user: `admin`,
      pass: `secret`,
    })
    expect(result).toContain(`existing`)
    expect(result).toContain(`creds`)
    expect(result).not.toContain(`admin`)
    expect(result).not.toContain(`secret`)
  })

  it(`should append params to the URL`, () => {
    const result = buildDBUrl({
      url: `postgresql://localhost:5432`,
      params: { sslmode: `require`, connect_timeout: `10` },
    })
    const parsed = new URL(result)
    expect(parsed.searchParams.get(`sslmode`)).toBe(`require`)
    expect(parsed.searchParams.get(`connect_timeout`)).toBe(`10`)
  })

  it(`should not override existing params in the URL`, () => {
    const result = buildDBUrl({
      url: `postgresql://localhost:5432?sslmode=disable`,
      params: { sslmode: `require` },
    })
    const parsed = new URL(result)
    expect(parsed.searchParams.get(`sslmode`)).toBe(`disable`)
  })

  it(`should add database name as pathname`, () => {
    const result = buildDBUrl({ url: `postgresql://localhost:5432`, name: `mydb` })
    const parsed = new URL(result)
    expect(parsed.pathname).toBe(`/mydb`)
  })

  it(`should trim leading slashes from database name`, () => {
    const result = buildDBUrl({ url: `postgresql://localhost:5432`, name: `///mydb` })
    const parsed = new URL(result)
    expect(parsed.pathname).toBe(`/mydb`)
  })

  it(`should not override existing pathname with name`, () => {
    const result = buildDBUrl({
      url: `postgresql://localhost:5432/existing`,
      name: `newdb`,
    })
    const parsed = new URL(result)
    expect(parsed.pathname).toBe(`/existing`)
  })

  it(`should use custom proto with host`, () => {
    const result = buildDBUrl({ host: `localhost:3306`, proto: `mysql` })
    expect(result).toContain(`mysql://localhost:3306`)
  })
})
