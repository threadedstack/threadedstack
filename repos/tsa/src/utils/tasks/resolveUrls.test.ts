import { resolveProxyUrl, resolveThreadsUrl, resolveAuthUrl } from './resolveUrls'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const envKeys = [`NODE_ENV`, `TDSK_PX_URL`, `TDSK_TH_APP_URL`] as const
type EnvSnapshot = Record<string, string | undefined>

let savedEnv: EnvSnapshot

beforeEach(() => {
  savedEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]))
  for (const k of envKeys) delete process.env[k]
})

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v !== undefined) process.env[k] = v
    else delete process.env[k]
  }
})

describe(`resolveProxyUrl`, () => {
  it(`returns config proxyUrl when set`, () => {
    const config = { auth: { proxyUrl: `https://custom.proxy.com` } }
    expect(resolveProxyUrl(config)).toBe(`https://custom.proxy.com`)
  })

  it(`config proxyUrl takes priority over env var`, () => {
    process.env.TDSK_PX_URL = `https://env.proxy.com`
    const config = { auth: { proxyUrl: `https://custom.proxy.com` } }
    expect(resolveProxyUrl(config)).toBe(`https://custom.proxy.com`)
  })

  it(`falls back to TDSK_PX_URL when no config`, () => {
    process.env.TDSK_PX_URL = `https://env.proxy.com`
    expect(resolveProxyUrl()).toBe(`https://env.proxy.com`)
  })

  it(`strips trailing slash from env var`, () => {
    process.env.TDSK_PX_URL = `https://env.proxy.com/`
    expect(resolveProxyUrl()).toBe(`https://env.proxy.com`)
  })

  it(`env var takes priority over NODE_ENV`, () => {
    process.env.NODE_ENV = `production`
    process.env.TDSK_PX_URL = `https://env.proxy.com`
    expect(resolveProxyUrl()).toBe(`https://env.proxy.com`)
  })

  it(`returns local proxy URL when NODE_ENV is local`, () => {
    process.env.NODE_ENV = `local`
    expect(resolveProxyUrl()).toBe(`https://px.local.threadedstack.app`)
  })

  it(`returns develop proxy URL when NODE_ENV is develop`, () => {
    process.env.NODE_ENV = `develop`
    expect(resolveProxyUrl()).toBe(`https://px.dev.threadedstack.app`)
  })

  it(`returns production proxy URL when NODE_ENV is production`, () => {
    process.env.NODE_ENV = `production`
    expect(resolveProxyUrl()).toBe(`https://px.threadedstack.app`)
  })

  it(`defaults to local proxy URL when NODE_ENV is not set`, () => {
    expect(resolveProxyUrl()).toBe(`https://px.local.threadedstack.app`)
  })

  it(`defaults to local proxy URL for unknown NODE_ENV`, () => {
    process.env.NODE_ENV = `staging`
    expect(resolveProxyUrl()).toBe(`https://px.local.threadedstack.app`)
  })

  it(`ignores empty config auth`, () => {
    expect(resolveProxyUrl({})).toBe(`https://px.local.threadedstack.app`)
  })
})

describe(`resolveThreadsUrl`, () => {
  it(`returns config threadsUrl when set`, () => {
    const config = { auth: { threadsUrl: `https://custom.threads.com` } }
    expect(resolveThreadsUrl(config)).toBe(`https://custom.threads.com`)
  })

  it(`config threadsUrl takes priority over env var`, () => {
    process.env.TDSK_TH_APP_URL = `https://env.threads.com`
    const config = { auth: { threadsUrl: `https://custom.threads.com` } }
    expect(resolveThreadsUrl(config)).toBe(`https://custom.threads.com`)
  })

  it(`falls back to TDSK_TH_APP_URL when no config`, () => {
    process.env.TDSK_TH_APP_URL = `https://env.threads.com`
    expect(resolveThreadsUrl()).toBe(`https://env.threads.com`)
  })

  it(`strips trailing slash from env var`, () => {
    process.env.TDSK_TH_APP_URL = `https://env.threads.com/`
    expect(resolveThreadsUrl()).toBe(`https://env.threads.com`)
  })

  it(`env var takes priority over NODE_ENV`, () => {
    process.env.NODE_ENV = `production`
    process.env.TDSK_TH_APP_URL = `https://env.threads.com`
    expect(resolveThreadsUrl()).toBe(`https://env.threads.com`)
  })

  it(`returns local threads URL when NODE_ENV is local`, () => {
    process.env.NODE_ENV = `local`
    expect(resolveThreadsUrl()).toBe(`http://localhost:5886`)
  })

  it(`returns develop threads URL when NODE_ENV is develop`, () => {
    process.env.NODE_ENV = `develop`
    expect(resolveThreadsUrl()).toBe(`https://threads.dev.threadedstack.com`)
  })

  it(`returns production threads URL when NODE_ENV is production`, () => {
    process.env.NODE_ENV = `production`
    expect(resolveThreadsUrl()).toBe(`https://threads.threadedstack.com`)
  })

  it(`defaults to local threads URL when NODE_ENV is not set`, () => {
    expect(resolveThreadsUrl()).toBe(`http://localhost:5886`)
  })

  it(`defaults to local threads URL for unknown NODE_ENV`, () => {
    process.env.NODE_ENV = `staging`
    expect(resolveThreadsUrl()).toBe(`http://localhost:5886`)
  })

  it(`ignores empty config auth`, () => {
    expect(resolveThreadsUrl({})).toBe(`http://localhost:5886`)
  })
})

describe(`resolveAuthUrl`, () => {
  it(`always uses threads URL even when neonAuthUrl is in config`, () => {
    const config = { auth: { neonAuthUrl: `https://neon.example.com` } }
    expect(resolveAuthUrl(config as any)).toBe(`http://localhost:5886/auth/cli`)
  })

  it(`uses TDSK_TH_APP_URL env var`, () => {
    process.env.TDSK_TH_APP_URL = `https://threads.env.com`
    expect(resolveAuthUrl()).toBe(`https://threads.env.com/auth/cli`)
  })

  it(`strips trailing slash from env var`, () => {
    process.env.TDSK_TH_APP_URL = `https://threads.env.com/`
    expect(resolveAuthUrl()).toBe(`https://threads.env.com/auth/cli`)
  })

  it(`returns local auth URL when NODE_ENV is local`, () => {
    process.env.NODE_ENV = `local`
    expect(resolveAuthUrl()).toBe(`http://localhost:5886/auth/cli`)
  })

  it(`returns develop auth URL when NODE_ENV is develop`, () => {
    process.env.NODE_ENV = `develop`
    expect(resolveAuthUrl()).toBe(`https://threads.dev.threadedstack.com/auth/cli`)
  })

  it(`returns production auth URL when NODE_ENV is production`, () => {
    process.env.NODE_ENV = `production`
    expect(resolveAuthUrl()).toBe(`https://threads.threadedstack.com/auth/cli`)
  })

  it(`defaults to local auth URL when NODE_ENV is not set`, () => {
    expect(resolveAuthUrl()).toBe(`http://localhost:5886/auth/cli`)
  })

  it(`defaults to local auth URL when config has no auth property`, () => {
    expect(resolveAuthUrl({} as any)).toBe(`http://localhost:5886/auth/cli`)
  })

  it(`env var takes priority over NODE_ENV`, () => {
    process.env.NODE_ENV = `production`
    process.env.TDSK_TH_APP_URL = `https://custom-threads.com`
    expect(resolveAuthUrl()).toBe(`https://custom-threads.com/auth/cli`)
  })

  it(`uses config threadsUrl for auth URL`, () => {
    const config = { auth: { threadsUrl: `https://custom.threads.com` } }
    expect(resolveAuthUrl(config as any)).toBe(`https://custom.threads.com/auth/cli`)
  })
})
