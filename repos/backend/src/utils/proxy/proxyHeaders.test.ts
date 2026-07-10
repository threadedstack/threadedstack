import type { Request } from 'express'
import type { Secret } from '@tdsk/domain'
import type { TBEConfig } from '@TBE/types'
import type { ClientRequest, IncomingMessage } from 'http'

import { describe, it, expect, vi } from 'vitest'
import { addProxyHeader, addEndpointHeaders, addOriginHeader } from './proxyHeaders'

const buildProxyReq = () =>
  ({
    removeHeader: vi.fn(),
    setHeader: vi.fn(),
  }) as unknown as ClientRequest

const buildConfig = (overrides: Partial<TBEConfig['proxy']> = {}) =>
  ({
    proxy: { headerKey: ``, headerValue: ``, ...overrides },
    server: { origins: [] as string[] },
  }) as unknown as TBEConfig

describe(`addProxyHeader`, () => {
  it(`does nothing when headerKey is not configured`, () => {
    const proxyReq = buildProxyReq()
    addProxyHeader(proxyReq, buildConfig({ headerKey: `` }))

    expect(proxyReq.removeHeader).not.toHaveBeenCalled()
    expect(proxyReq.setHeader).not.toHaveBeenCalled()
  })

  it(`removes the existing header before setting the configured value`, () => {
    const proxyReq = buildProxyReq()
    addProxyHeader(
      proxyReq,
      buildConfig({ headerKey: `x-tdsk-proxy`, headerValue: `secret-val` })
    )

    expect(proxyReq.removeHeader).toHaveBeenCalledWith(`x-tdsk-proxy`)
    expect(proxyReq.setHeader).toHaveBeenCalledWith(`x-tdsk-proxy`, `secret-val`)
  })

  it(`removes the header but does not set it when headerValue is empty`, () => {
    const proxyReq = buildProxyReq()
    addProxyHeader(proxyReq, buildConfig({ headerKey: `x-tdsk-proxy`, headerValue: `` }))

    expect(proxyReq.removeHeader).toHaveBeenCalledWith(`x-tdsk-proxy`)
    expect(proxyReq.setHeader).not.toHaveBeenCalled()
  })
})

describe(`addEndpointHeaders`, () => {
  it(`does nothing when headers is null`, () => {
    const proxyReq = buildProxyReq()
    addEndpointHeaders(proxyReq, null as unknown as Record<string, string>)

    expect(proxyReq.setHeader).not.toHaveBeenCalled()
  })

  it(`does nothing when headers is not an object`, () => {
    const proxyReq = buildProxyReq()
    addEndpointHeaders(proxyReq, `not-an-object` as unknown as Record<string, string>)

    expect(proxyReq.setHeader).not.toHaveBeenCalled()
  })

  it(`applies plain headers as-is when no secrets are provided`, () => {
    const proxyReq = buildProxyReq()
    addEndpointHeaders(proxyReq, { 'x-api-version': `2026-01-01`, 'x-client': `tdsk` })

    expect(proxyReq.setHeader).toHaveBeenCalledWith(`x-api-version`, `2026-01-01`)
    expect(proxyReq.setHeader).toHaveBeenCalledWith(`x-client`, `tdsk`)
  })

  it(`skips entries with an empty key or falsy value`, () => {
    const proxyReq = buildProxyReq()
    addEndpointHeaders(proxyReq, { '': `orphan`, 'x-empty': ``, 'x-real': `value` })

    expect(proxyReq.setHeader).toHaveBeenCalledTimes(1)
    expect(proxyReq.setHeader).toHaveBeenCalledWith(`x-real`, `value`)
  })

  it(`resolves {{ name:id }} secret references before applying headers`, () => {
    const proxyReq = buildProxyReq()
    const secrets = [{ id: `sc12345678`, value: `resolved-secret` } as unknown as Secret]

    addEndpointHeaders(
      proxyReq,
      { authorization: `Bearer {{ api-key:sc12345678 }}` },
      secrets
    )

    expect(proxyReq.setHeader).toHaveBeenCalledWith(
      `authorization`,
      `Bearer resolved-secret`
    )
  })

  it(`leaves the template untouched when the secret id is unresolved`, () => {
    const proxyReq = buildProxyReq()
    const secrets = [{ id: `scOTHER001`, value: `unrelated` } as unknown as Secret]

    addEndpointHeaders(
      proxyReq,
      { authorization: `Bearer {{ api-key:sc12345678 }}` },
      secrets
    )

    expect(proxyReq.setHeader).toHaveBeenCalledWith(
      `authorization`,
      `Bearer {{ api-key:sc12345678 }}`
    )
  })

  it(`skips secret replacement when the secrets array is empty`, () => {
    const proxyReq = buildProxyReq()
    addEndpointHeaders(proxyReq, { 'x-plain': `value` }, [])

    expect(proxyReq.setHeader).toHaveBeenCalledWith(`x-plain`, `value`)
  })
})

describe(`addOriginHeader`, () => {
  const buildRes = () => ({ headers: {} }) as unknown as IncomingMessage
  const buildReq = (origin: string) =>
    ({
      get: (name: string) => (name === `origin` ? origin : undefined),
    }) as unknown as Request

  it(`sets Access-Control-Allow-Origin when the request origin is allow-listed`, () => {
    const proxyRes = buildRes()
    const req = buildReq(`https://app.threadedstack.com`)
    const config = buildConfig()
    config.server.origins = [`https://app.threadedstack.com`]

    addOriginHeader(proxyRes, req, config)

    expect(proxyRes.headers[`Access-Control-Allow-Origin`]).toBe(
      `https://app.threadedstack.com`
    )
  })

  it(`sets the request origin verbatim when origins includes the wildcard`, () => {
    const proxyRes = buildRes()
    const req = buildReq(`https://untrusted.example.com`)
    const config = buildConfig()
    config.server.origins = [`*`]

    addOriginHeader(proxyRes, req, config)

    expect(proxyRes.headers[`Access-Control-Allow-Origin`]).toBe(
      `https://untrusted.example.com`
    )
  })

  it(`does not set the header when the origin is not allow-listed`, () => {
    const proxyRes = buildRes()
    const req = buildReq(`https://untrusted.example.com`)
    const config = buildConfig()
    config.server.origins = [`https://app.threadedstack.com`]

    addOriginHeader(proxyRes, req, config)

    expect(proxyRes.headers[`Access-Control-Allow-Origin`]).toBeUndefined()
  })

  it(`trims whitespace from the origin header before comparing`, () => {
    const proxyRes = buildRes()
    const req = buildReq(`  https://app.threadedstack.com  `)
    const config = buildConfig()
    config.server.origins = [`https://app.threadedstack.com`]

    addOriginHeader(proxyRes, req, config)

    expect(proxyRes.headers[`Access-Control-Allow-Origin`]).toBe(
      `https://app.threadedstack.com`
    )
  })

  it(`does not set the header when no origin is present and empty string is not allow-listed`, () => {
    const proxyRes = buildRes()
    const req = buildReq(``)
    const config = buildConfig()
    config.server.origins = [`https://app.threadedstack.com`]

    addOriginHeader(proxyRes, req, config)

    expect(proxyRes.headers[`Access-Control-Allow-Origin`]).toBeUndefined()
  })
})
