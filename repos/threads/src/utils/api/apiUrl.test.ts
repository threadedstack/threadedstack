import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const envs = vi.hoisted(() => ({
  TDSK_PX_URL: undefined as string | undefined,
  TDSK_PX_HOST: undefined as string | undefined,
  TDSK_PX_PORT: undefined as string | undefined,
  TDSK_CADDY_PX_HOST: undefined as string | undefined,
}))

vi.mock(`@TTH/constants/envs`, () => envs)

import { apiUrl } from './apiUrl'

const originalLocation = window.location

const setLocation = (overrides: Record<string, unknown> = {}) => {
  Object.defineProperty(window, `location`, {
    configurable: true,
    value: {
      ...originalLocation,
      protocol: `http:`,
      port: ``,
      ...overrides,
    },
  })
}

describe(`apiUrl`, () => {
  beforeEach(() => {
    envs.TDSK_PX_URL = undefined
    envs.TDSK_PX_HOST = undefined
    envs.TDSK_PX_PORT = undefined
    envs.TDSK_CADDY_PX_HOST = undefined
    setLocation()
  })

  afterEach(() => {
    Object.defineProperty(window, `location`, {
      configurable: true,
      value: originalLocation,
    })
  })

  describe(`proxy branch`, () => {
    it(`prefixes a bare proxy host with https://`, () => {
      expect(apiUrl({ proxy: `proxy.example.com` })).toBe(`https://proxy.example.com`)
    })

    it(`returns a proxy value already starting with http unchanged`, () => {
      expect(apiUrl({ proxy: `http://proxy.example.com` })).toBe(
        `http://proxy.example.com`
      )
    })

    it(`falls back to the TDSK_CADDY_PX_HOST env default when opts.proxy is not passed`, () => {
      envs.TDSK_CADDY_PX_HOST = `env-proxy.example.com`
      expect(apiUrl({})).toBe(`https://env-proxy.example.com`)
    })
  })

  describe(`url branch`, () => {
    it(`returns new URL(url).toString() when proxy is falsy and url is set, ignoring host/port`, () => {
      const result = apiUrl({
        url: `https://url.example.com/`,
        host: `should-be-ignored.example.com`,
        port: `9999`,
      })
      expect(result).toBe(`https://url.example.com/`)
    })
  })

  describe(`host-required error branch`, () => {
    it(`throws when proxy, url, and host are all falsy`, () => {
      expect(() => apiUrl({})).toThrow(`A valid URL or host is required!`)
    })
  })

  describe(`host branch`, () => {
    it(`prefixes a bare host with window.location.protocol`, () => {
      setLocation({ protocol: `https:` })
      expect(apiUrl({ host: `host.example.com` })).toBe(`https://host.example.com/`)
    })

    it(`uses a host already prefixed with http/https as-is, without prepending window.location.protocol`, () => {
      setLocation({ protocol: `https:` })
      expect(apiUrl({ host: `http://host.example.com` })).toBe(`http://host.example.com/`)
    })

    it(`appends :port when port is truthy`, () => {
      expect(apiUrl({ host: `host.example.com`, port: `4000` })).toBe(
        `http://host.example.com:4000/`
      )
    })

    it(`appends no port segment when port is falsy and window.location.port is empty`, () => {
      expect(apiUrl({ host: `host.example.com` })).toBe(`http://host.example.com/`)
    })

    it(`falls back to window.location.port when opts.port is not passed and TDSK_PX_PORT is unset`, () => {
      setLocation({ port: `5887` })
      expect(apiUrl({ host: `host.example.com` })).toBe(`http://host.example.com:5887/`)
    })
  })
})
