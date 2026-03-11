import type { TRouteMap, EContainerState } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──

const mockProxy = {
  use: vi.fn(),
  onRequest: vi.fn(),
  onError: vi.fn(),
  listen: vi.fn(),
  close: vi.fn(),
  httpPort: 19999,
  onCertificateRequired: null as any,
}

vi.mock(`http-mitm-proxy`, () => ({
  Proxy: Object.assign(
    vi.fn(() => mockProxy),
    {
      wildcard: `wildcard-sentinel`,
    }
  ),
}))

const mockFrontServer = {
  listen: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
}

vi.mock(`net`, async (importOriginal) => {
  const orig = await importOriginal<typeof import('net')>()
  return {
    ...orig,
    default: {
      ...orig,
      createServer: vi.fn(() => mockFrontServer),
      connect: orig.connect,
    },
  }
})

const { mockPublicKeyExport } = vi.hoisted(() => ({
  mockPublicKeyExport: vi
    .fn()
    .mockReturnValue(`-----BEGIN PUBLIC KEY-----\nmock\n-----END PUBLIC KEY-----`),
}))

vi.mock(`fs`, async (importOriginal) => {
  const orig = await importOriginal<typeof import('fs')>()
  return {
    ...orig,
    default: {
      ...orig,
      mkdtempSync: vi.fn().mockReturnValue(`/tmp/tdsk-egress-ca-test123`),
      mkdirSync: vi.fn(),
      copyFileSync: vi.fn(),
      readFileSync: vi
        .fn()
        .mockReturnValue(
          `-----BEGIN RSA PRIVATE KEY-----\nmock\n-----END RSA PRIVATE KEY-----`
        ),
      writeFileSync: vi.fn(),
      rmSync: vi.fn(),
    },
  }
})

vi.mock(`crypto`, async (importOriginal) => {
  const orig = await importOriginal<typeof import('crypto')>()
  return {
    ...orig,
    createPrivateKey: vi.fn().mockReturnValue({ type: `private` }),
    createPublicKey: vi.fn().mockReturnValue({
      export: mockPublicKeyExport,
    }),
  }
})

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/constants/values`, () => ({
  PhTokenPrefix: `tdsk_ph_`,
}))

// ── Helpers ──

const makeRoutes = (): TRouteMap => ({
  'sb-abc12345-xxxx': {
    meta: {
      podIp: `10.0.0.5`,
      state: `Running` as EContainerState,
      sandboxId: `abc12345`,
      podName: `tdsk-sb-abc12345-xxxx`,
    },
    placeholders: {
      tdsk_ph_token1: `secret-id-1`,
      tdsk_ph_token2: `secret-id-2`,
    },
    ports: {
      '3000': { host: `10.0.0.5`, port: 3000, protocol: `http` as const },
    },
  },
})

const makeOpts = (overrides: Record<string, unknown> = {}) => ({
  port: 8888,
  caKeyPath: `/etc/tdsk/ca/tls.key`,
  caCertPath: `/etc/tdsk/ca/tls.crt`,
  routes: makeRoutes(),
  resolveSecret: vi.fn().mockResolvedValue(`resolved-secret-value`),
  ...overrides,
})

/**
 * Build a minimal IContext stub with the given source IP and headers.
 * The real IP is passed via the x-tdsk-real-ip header (injected by the front TCP server).
 */
const makeCtx = (sourceIp?: string, headers: Record<string, string | string[]> = {}) => {
  const proxyHeaders: Record<string, string | string[]> = { ...headers }
  if (sourceIp) proxyHeaders[`x-tdsk-real-ip`] = sourceIp
  return {
    clientToProxyRequest: {
      socket: { remoteAddress: `127.0.0.1` },
      headers: sourceIp ? { 'x-tdsk-real-ip': sourceIp } : {},
    },
    proxyToServerRequestOptions: { headers: proxyHeaders },
    proxyToClientResponse: {
      headersSent: false,
      writeHead: vi.fn(),
      end: vi.fn(),
    },
  } as any
}

// ── Tests ──

describe(`EgressProxy`, () => {
  let EgressProxy: typeof import('./egress').EgressProxy

  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset mockProxy state for each test
    mockProxy.use.mockReset()
    mockProxy.onRequest.mockReset()
    mockProxy.onError.mockReset()
    mockProxy.listen.mockReset()
    mockProxy.close.mockReset()
    mockProxy.httpPort = 19999
    mockProxy.onCertificateRequired = null

    // Reset front server mocks
    mockFrontServer.listen.mockReset()
    mockFrontServer.close.mockReset()
    mockFrontServer.on.mockReset()

    // Re-import to get a fresh module (constructor runs at instantiation, not import)
    const mod = await import(`./egress`)
    EgressProxy = mod.EgressProxy
  })

  // ── Constructor ──

  describe(`constructor`, () => {
    it(`should register onRequest handler`, () => {
      new EgressProxy(makeOpts() as any)

      expect(mockProxy.onRequest).toHaveBeenCalledOnce()
      expect(typeof mockProxy.onRequest.mock.calls[0][0]).toBe(`function`)
    })

    it(`should NOT override onCertificateRequired (uses sslCaDir instead)`, () => {
      new EgressProxy(makeOpts() as any)

      // onCertificateRequired should remain the proxy's default (not overridden)
      expect(mockProxy.onCertificateRequired).toBeNull()
    })

    it(`should call proxy.use with Proxy.wildcard`, () => {
      new EgressProxy(makeOpts() as any)

      expect(mockProxy.use).toHaveBeenCalledWith(`wildcard-sentinel`)
    })
  })

  // ── handleRequest (via onRequest handler) ──

  describe(`handleRequest`, () => {
    /**
     * Helper: instantiate EgressProxy and return the captured onRequest handler.
     */
    const setup = (optsOverride: Record<string, unknown> = {}) => {
      const opts = makeOpts(optsOverride)
      new EgressProxy(opts as any)

      // onRequest receives (ctx, callback)
      const onRequestHandler = mockProxy.onRequest.mock.calls[0][0] as (
        ctx: any,
        callback: (...args: any[]) => void
      ) => void

      return { opts, onRequestHandler }
    }

    it(`should skip processing when source IP has no matching route`, async () => {
      const { opts, onRequestHandler } = setup()
      const ctx = makeCtx(`192.168.1.99`, { authorization: `Bearer tdsk_ph_token1` })
      const callback = vi.fn()

      onRequestHandler(ctx, callback)
      // Let async handleRequest resolve
      await vi.waitFor(() => expect(callback).toHaveBeenCalled())

      // resolveSecret should NOT have been called because findPlaceholders returned null
      expect(opts.resolveSecret).not.toHaveBeenCalled()
      // Authorization header unchanged
      expect(ctx.proxyToServerRequestOptions.headers.authorization).toBe(
        `Bearer tdsk_ph_token1`
      )
    })

    it(`should skip processing when source IP is undefined`, async () => {
      const { opts, onRequestHandler } = setup()
      const ctx = makeCtx(undefined, { authorization: `Bearer tdsk_ph_token1` })
      const callback = vi.fn()

      onRequestHandler(ctx, callback)
      await vi.waitFor(() => expect(callback).toHaveBeenCalled())

      expect(opts.resolveSecret).not.toHaveBeenCalled()
    })

    it(`should replace authorization header placeholder tokens with secrets`, async () => {
      const { opts, onRequestHandler } = setup()
      opts.resolveSecret.mockResolvedValue(`real-api-key`)
      const ctx = makeCtx(`10.0.0.5`, { authorization: `Bearer tdsk_ph_token1` })
      const callback = vi.fn()

      onRequestHandler(ctx, callback)
      await vi.waitFor(() => expect(callback).toHaveBeenCalled())

      expect(opts.resolveSecret).toHaveBeenCalledWith(`secret-id-1`)
      expect(ctx.proxyToServerRequestOptions.headers.authorization).toBe(
        `Bearer real-api-key`
      )
    })

    it(`should handle authorization header as string[] (array form — takes first element)`, async () => {
      const { opts, onRequestHandler } = setup()
      opts.resolveSecret.mockResolvedValue(`real-api-key`)
      const ctx = makeCtx(`10.0.0.5`, {
        authorization: [`Bearer tdsk_ph_token1`, `Bearer other`] as any,
      })
      const callback = vi.fn()

      onRequestHandler(ctx, callback)
      await vi.waitFor(() => expect(callback).toHaveBeenCalled())

      // Should have used the first element from the array
      expect(opts.resolveSecret).toHaveBeenCalledWith(`secret-id-1`)
      expect(ctx.proxyToServerRequestOptions.headers.authorization).toBe(
        `Bearer real-api-key`
      )
    })

    it(`should replace placeholders in non-auth headers`, async () => {
      const { opts, onRequestHandler } = setup()
      opts.resolveSecret.mockResolvedValue(`secret-val`)
      const ctx = makeCtx(`10.0.0.5`, {
        'x-custom-key': `prefix-tdsk_ph_token1-suffix`,
      })
      const callback = vi.fn()

      onRequestHandler(ctx, callback)
      await vi.waitFor(() => expect(callback).toHaveBeenCalled())

      expect(ctx.proxyToServerRequestOptions.headers[`x-custom-key`]).toBe(
        `prefix-secret-val-suffix`
      )
    })

    it(`should NOT replace headers without PhTokenPrefix`, async () => {
      const { opts, onRequestHandler } = setup()
      const ctx = makeCtx(`10.0.0.5`, {
        'x-safe-header': `no-placeholder-here`,
      })
      const callback = vi.fn()

      onRequestHandler(ctx, callback)
      await vi.waitFor(() => expect(callback).toHaveBeenCalled())

      expect(ctx.proxyToServerRequestOptions.headers[`x-safe-header`]).toBe(
        `no-placeholder-here`
      )
      // resolveSecret should not be called for headers without the prefix
      // (it may be called 0 times if there's no auth header either)
      expect(opts.resolveSecret).not.toHaveBeenCalled()
    })

    it(`should trigger 502 when resolveSecret returns null`, async () => {
      const { logger } = await import(`@TBE/utils/logger`)
      const { opts, onRequestHandler } = setup()
      opts.resolveSecret.mockResolvedValue(null)
      const ctx = makeCtx(`10.0.0.5`, {
        authorization: `Bearer tdsk_ph_token1`,
      })
      const callback = vi.fn()

      onRequestHandler(ctx, callback)
      // The catch handler writes 502 — wait for the response to be written
      await vi.waitFor(() =>
        expect(ctx.proxyToClientResponse.writeHead).toHaveBeenCalled()
      )

      expect(ctx.proxyToClientResponse.writeHead).toHaveBeenCalledWith(502, {
        'Content-Type': `application/json`,
      })
      expect(ctx.proxyToClientResponse.end).toHaveBeenCalledWith(
        JSON.stringify({ error: `Egress proxy failed to process request` })
      )
      expect(logger.error).toHaveBeenCalled()
      // callback should NOT have been called on error path
      expect(callback).not.toHaveBeenCalled()
    })

    it(`should handle multiple placeholder tokens in same header value`, async () => {
      const { opts, onRequestHandler } = setup()
      opts.resolveSecret
        .mockResolvedValueOnce(`secret-A`)
        .mockResolvedValueOnce(`secret-B`)

      const ctx = makeCtx(`10.0.0.5`, {
        'x-multi': `tdsk_ph_token1:tdsk_ph_token2`,
      })
      const callback = vi.fn()

      onRequestHandler(ctx, callback)
      await vi.waitFor(() => expect(callback).toHaveBeenCalled())

      expect(ctx.proxyToServerRequestOptions.headers[`x-multi`]).toBe(`secret-A:secret-B`)
      expect(opts.resolveSecret).toHaveBeenCalledWith(`secret-id-1`)
      expect(opts.resolveSecret).toHaveBeenCalledWith(`secret-id-2`)
    })
  })

  // ── findPlaceholders (tested indirectly via handleRequest) ──

  describe(`findPlaceholders`, () => {
    const setup = (optsOverride: Record<string, unknown> = {}) => {
      const opts = makeOpts(optsOverride)
      new EgressProxy(opts as any)
      const onRequestHandler = mockProxy.onRequest.mock.calls[0][0] as (
        ctx: any,
        callback: (...args: any[]) => void
      ) => void
      return { opts, onRequestHandler }
    }

    it(`should return null when route has empty placeholders object`, async () => {
      const routes: TRouteMap = {
        'sb-empty': {
          meta: {
            podIp: `10.0.0.9`,
            state: `Running` as EContainerState,
            sandboxId: `empty123`,
            podName: `tdsk-sb-empty`,
          },
          placeholders: {},
          ports: {},
        },
      }

      const { opts, onRequestHandler } = setup({ routes })
      const ctx = makeCtx(`10.0.0.9`, { authorization: `Bearer tdsk_ph_token1` })
      const callback = vi.fn()

      onRequestHandler(ctx, callback)
      await vi.waitFor(() => expect(callback).toHaveBeenCalled())

      // Since placeholders is empty, findPlaceholders returns null → no replacement
      expect(opts.resolveSecret).not.toHaveBeenCalled()
      expect(ctx.proxyToServerRequestOptions.headers.authorization).toBe(
        `Bearer tdsk_ph_token1`
      )
    })

    it(`should match on podIp`, async () => {
      const { opts, onRequestHandler } = setup()
      opts.resolveSecret.mockResolvedValue(`matched-secret`)
      const ctx = makeCtx(`10.0.0.5`, { authorization: `Bearer tdsk_ph_token1` })
      const callback = vi.fn()

      onRequestHandler(ctx, callback)
      await vi.waitFor(() => expect(callback).toHaveBeenCalled())

      expect(opts.resolveSecret).toHaveBeenCalledWith(`secret-id-1`)
      expect(ctx.proxyToServerRequestOptions.headers.authorization).toBe(
        `Bearer matched-secret`
      )
    })

    it(`should normalize IPv6-mapped IPv4 addresses`, async () => {
      const { opts, onRequestHandler } = setup()
      opts.resolveSecret.mockResolvedValue(`secret-val`)
      const ctx = makeCtx(`::ffff:10.0.0.5`, { authorization: `Bearer tdsk_ph_token1` })
      const callback = vi.fn()

      onRequestHandler(ctx, callback)
      await vi.waitFor(() => expect(callback).toHaveBeenCalled())

      expect(opts.resolveSecret).toHaveBeenCalledWith(`secret-id-1`)
    })

    it(`should read real IP from connectRequest headers (HTTPS path)`, async () => {
      const { opts, onRequestHandler } = setup()
      opts.resolveSecret.mockResolvedValue(`https-secret`)
      const ctx = {
        connectRequest: { headers: { 'x-tdsk-real-ip': `10.0.0.5` } },
        clientToProxyRequest: { socket: { remoteAddress: `127.0.0.1` }, headers: {} },
        proxyToServerRequestOptions: {
          headers: { authorization: `Bearer tdsk_ph_token1` },
        },
        proxyToClientResponse: { headersSent: false, writeHead: vi.fn(), end: vi.fn() },
      } as any
      const callback = vi.fn()

      onRequestHandler(ctx, callback)
      await vi.waitFor(() => expect(callback).toHaveBeenCalled())

      expect(opts.resolveSecret).toHaveBeenCalledWith(`secret-id-1`)
      expect(ctx.proxyToServerRequestOptions.headers.authorization).toBe(
        `Bearer https-secret`
      )
    })

    it(`should strip x-tdsk-real-ip header before forwarding`, async () => {
      const { onRequestHandler } = setup()
      const ctx = makeCtx(`10.0.0.5`)
      const callback = vi.fn()

      onRequestHandler(ctx, callback)
      await vi.waitFor(() => expect(callback).toHaveBeenCalled())

      expect(ctx.proxyToServerRequestOptions.headers[`x-tdsk-real-ip`]).toBeUndefined()
    })
  })

  // ── replaceTokens (tested indirectly via handleRequest) ──

  describe(`replaceTokens`, () => {
    const setup = (optsOverride: Record<string, unknown> = {}) => {
      const opts = makeOpts(optsOverride)
      new EgressProxy(opts as any)
      const onRequestHandler = mockProxy.onRequest.mock.calls[0][0] as (
        ctx: any,
        callback: (...args: any[]) => void
      ) => void
      return { opts, onRequestHandler }
    }

    it(`should replace single token with secret value`, async () => {
      const { opts, onRequestHandler } = setup()
      opts.resolveSecret.mockResolvedValue(`my-secret`)
      const ctx = makeCtx(`10.0.0.5`, {
        'x-api-key': `tdsk_ph_token1`,
      })
      const callback = vi.fn()

      onRequestHandler(ctx, callback)
      await vi.waitFor(() => expect(callback).toHaveBeenCalled())

      expect(ctx.proxyToServerRequestOptions.headers[`x-api-key`]).toBe(`my-secret`)
    })

    it(`should throw with descriptive message when secret is null`, async () => {
      const { logger } = await import(`@TBE/utils/logger`)
      const { opts, onRequestHandler } = setup()
      opts.resolveSecret.mockResolvedValue(null)
      const ctx = makeCtx(`10.0.0.5`, {
        'x-api-key': `tdsk_ph_token1`,
      })
      const callback = vi.fn()

      onRequestHandler(ctx, callback)
      await vi.waitFor(() =>
        expect(ctx.proxyToClientResponse.writeHead).toHaveBeenCalled()
      )

      // Verify logger.error was called with the descriptive error
      const errorCall = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(errorCall[0]).toContain(`[EgressProxy]`)
      const errorArg = errorCall[1] as Error
      expect(errorArg.message).toContain(`secret-id-1`)
      expect(errorArg.message).toContain(`tdsk_ph_toke`)
    })
  })

  // ── start / stop ──

  describe(`start`, () => {
    it(`should prepare CA dir then start MITM proxy and front TCP server`, async () => {
      const net = await import(`net`)
      const fsModule = await import(`fs`)
      const proxy = new EgressProxy(makeOpts() as any)

      // MITM proxy listen resolves immediately with httpPort set
      mockProxy.listen.mockImplementation((_opts: any, cb: () => void) => cb())
      // Front server listen resolves immediately
      mockFrontServer.listen.mockImplementation(
        (_port: number, _host: string, cb: () => void) => cb()
      )

      await expect(proxy.start()).resolves.toBeUndefined()

      // CA dir was prepared
      expect(fsModule.default.mkdtempSync).toHaveBeenCalled()
      expect(fsModule.default.mkdirSync).toHaveBeenCalledTimes(2) // certs/ and keys/
      expect(fsModule.default.copyFileSync).toHaveBeenCalledTimes(2) // ca cert + ca key

      // MITM proxy listens on random internal port with sslCaDir
      expect(mockProxy.listen).toHaveBeenCalledWith(
        { port: 0, host: `127.0.0.1`, sslCaDir: `/tmp/tdsk-egress-ca-test123` },
        expect.any(Function)
      )

      // Front server created and listens on public port
      expect(net.default.createServer).toHaveBeenCalledOnce()
      expect(mockFrontServer.listen).toHaveBeenCalledWith(
        8888,
        `0.0.0.0`,
        expect.any(Function)
      )
    })

    it(`should reject when MITM proxy emits error before started`, async () => {
      const proxy = new EgressProxy(makeOpts() as any)

      mockProxy.listen.mockImplementation(() => {})
      mockProxy.onError.mockImplementation((handler: (ctx: any, err: Error) => void) => {
        setTimeout(() => handler(null, new Error(`bind EADDRINUSE`)), 0)
      })

      await expect(proxy.start()).rejects.toThrow(`bind EADDRINUSE`)
    })

    it(`should log (not reject) when proxy emits error after started`, async () => {
      const { logger } = await import(`@TBE/utils/logger`)
      const proxy = new EgressProxy(makeOpts() as any)

      let errorHandler: ((ctx: any, err: Error) => void) | null = null

      mockProxy.onError.mockImplementation((handler: (ctx: any, err: Error) => void) => {
        errorHandler = handler
      })
      mockProxy.listen.mockImplementation((_opts: any, cb: () => void) => cb())
      mockFrontServer.listen.mockImplementation(
        (_port: number, _host: string, cb: () => void) => cb()
      )

      await proxy.start()

      // Now fire an error after started
      errorHandler!(null, new Error(`runtime error`))

      expect(logger.error).toHaveBeenCalledWith(
        `[EgressProxy] Proxy error:`,
        expect.any(Error)
      )
    })

    it(`should reject when MITM proxy listen throws synchronously`, async () => {
      const proxy = new EgressProxy(makeOpts() as any)

      mockProxy.onError.mockImplementation(() => {})
      mockProxy.listen.mockImplementation(() => {
        throw new Error(`sync listen failure`)
      })

      await expect(proxy.start()).rejects.toThrow(`sync listen failure`)
    })
  })

  describe(`stop`, () => {
    it(`should close both servers and clean up CA dir`, async () => {
      const fsModule = await import(`fs`)
      const proxy = new EgressProxy(makeOpts() as any)

      // Start to initialize frontServer and sslCaDir
      mockProxy.listen.mockImplementation((_opts: any, cb: () => void) => cb())
      mockFrontServer.listen.mockImplementation(
        (_port: number, _host: string, cb: () => void) => cb()
      )
      await proxy.start()

      proxy.stop()

      expect(mockFrontServer.close).toHaveBeenCalledOnce()
      expect(mockProxy.close).toHaveBeenCalledOnce()
      expect(fsModule.default.rmSync).toHaveBeenCalledWith(
        `/tmp/tdsk-egress-ca-test123`,
        { recursive: true, force: true }
      )
    })

    it(`should only close MITM proxy if front server was never started`, () => {
      const proxy = new EgressProxy(makeOpts() as any)

      proxy.stop()

      expect(mockProxy.close).toHaveBeenCalledOnce()
      // frontServer.close not called since start() was never called
    })
  })
})
