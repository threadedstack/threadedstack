import type { TApp } from '@TBE/types'
import type { IContext } from 'http-mitm-proxy'
import type { TRouteMap, TPlaceholderMap } from '@tdsk/domain'

import fs from 'fs'
import os from 'os'
import net from 'net'
import path from 'path'
import { existsSync } from 'node:fs'
import { Proxy } from 'http-mitm-proxy'
import { logger } from '@TBE/utils/logger'
import { isArr } from '@keg-hub/jsutils/isArr'
import { isStr } from '@keg-hub/jsutils/isStr'
import { extractSNI } from '@TBE/utils/proxy/extractSNI'
import { createPublicKey, createPrivateKey } from 'crypto'
import { CACertPath, CAKeyPath } from '@TBE/constants/values'
import { isDomainAllowed } from '@TBE/utils/proxy/domainMatch'
import { PhTokenPrefix, RealIpHeader } from '@TBE/constants/values'
import { SecretResolver } from '@TBE/services/secrets/secretResolver'

type TEgressProxyOpts = {
  port: number
  caKeyPath: string
  caCertPath: string
  routes: Readonly<TRouteMap>
  resolveSecret: (secretId: string) => Promise<string | null>
}

/**
 * Transparent MITM egress proxy for sandbox pods.
 *
 * All outbound HTTP/HTTPS traffic from sandbox pods is redirected here
 * via iptables DNAT rules in the pod init container.
 *
 * A protocol-sniffing TCP layer sits in front of http-mitm-proxy:
 * - HTTP traffic is piped directly to the MITM proxy
 * - TLS traffic (detected by 0x16 first byte) has its SNI extracted,
 *   gets converted to an HTTP CONNECT tunnel, and then forwarded —
 *   allowing http-mitm-proxy to handle HTTPS interception normally
 *
 * The MITM proxy intercepts requests, scans headers for placeholder
 * tokens (`tdsk_ph_*`), resolves them to real secret values, and
 * forwards the request to the original destination.
 *
 * Throws on unresolvable secrets to prevent placeholder tokens from
 * leaking to external services.
 */
export class EgressProxy {
  private port: number
  private proxy: Proxy
  private caKeyPath: string
  private caCertPath: string
  private mitmPort: number = 0
  private routes: Readonly<TRouteMap>
  private sslCaDir: string | null = null
  private frontServer: net.Server | null = null
  private resolveSecret: (secretId: string) => Promise<string | null>

  /**
   * Start the egress proxy if CA cert files are present.
   * The proxy intercepts outbound HTTP/HTTPS from sandbox pods and
   * replaces placeholder tokens with real secret values.
   */
  static init = async (app: TApp): Promise<EgressProxy | null> => {
    if (!app.locals.kube) return null

    try {
      if (!existsSync(CACertPath) || !existsSync(CAKeyPath)) {
        logger.warn(
          `[EgressProxy] CA cert files not found at ${CACertPath} / ${CAKeyPath}, egress proxy disabled`
        )
        return null
      }

      const secretResolver = new SecretResolver(app.locals.db)

      const resolveSecret = async (secretId: string): Promise<string | null> => {
        const { data: secret, error } = await app.locals.db.services.secret.get(secretId)
        if (error) {
          logger.error(`[EgressProxy] Failed to fetch secret ${secretId}:`, error.message)
          return null
        }
        if (!secret?.encryptedValue) return null
        return secretResolver.decrypt(secret, secret.orgId || ``)
      }

      const egressProxy = new EgressProxy({
        resolveSecret,
        caKeyPath: CAKeyPath,
        caCertPath: CACertPath,
        routes: app.locals.kube.routes,
        port: app.locals.config.egress.servicePort,
      })

      await egressProxy.start()
      logger.log(`[Sandbox] Sandbox Egress Proxy initialized`)

      return egressProxy
    } catch (err) {
      logger.error(`[Sandbox] Failed to initialize Sandbox Egress Proxy:`, err)
      return null
    }
  }

  constructor(opts: TEgressProxyOpts) {
    this.routes = opts.routes
    this.caKeyPath = opts.caKeyPath
    this.caCertPath = opts.caCertPath
    this.resolveSecret = opts.resolveSecret

    this.port = opts.port
    this.proxy = new Proxy()
    this.proxy.use(Proxy.wildcard)

    // Intercept requests — replace placeholder tokens with real secrets
    this.proxy.onRequest((ctx, callback) => {
      this.handleRequest(ctx)
        .then(() => callback())
        .catch((err) => {
          logger.error(`[EgressProxy] Request handling failed:`, err)
          const res = ctx.proxyToClientResponse
          if (res && !res.headersSent) {
            res.writeHead(502, { [`Content-Type`]: `application/json` })
            res.end(JSON.stringify({ error: `Egress proxy failed to process request` }))
          }
        })
    })
  }

  /**
   * Prepare a directory structure with our CA cert/key in the format
   * http-mitm-proxy expects for its internal CA. This allows the library
   * to auto-generate per-hostname certificates signed by our CA.
   *
   * Expected layout:
   *   ${sslCaDir}/certs/ca.pem         — CA certificate
   *   ${sslCaDir}/keys/ca.private.key  — CA private key
   *   ${sslCaDir}/keys/ca.public.key   — CA public key (derived)
   */
  private prepareCaDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `tdsk-egress-ca-`))
    const certsDir = path.join(dir, `certs`)
    const keysDir = path.join(dir, `keys`)
    fs.mkdirSync(certsDir)
    fs.mkdirSync(keysDir)

    fs.copyFileSync(this.caCertPath, path.join(certsDir, `ca.pem`))
    fs.copyFileSync(this.caKeyPath, path.join(keysDir, `ca.private.key`))

    const privateKey = createPrivateKey(fs.readFileSync(this.caKeyPath))
    const publicKey = createPublicKey(privateKey)
    fs.writeFileSync(
      path.join(keysDir, `ca.public.key`),
      publicKey.export({ type: `spki`, format: `pem` })
    )

    return dir
  }

  private async handleRequest(ctx: IContext): Promise<void> {
    // Recover real client IP from custom header injected by the front TCP server.
    // The MITM proxy only sees 127.0.0.1 since connections are proxied internally.
    const sourceIp =
      ((ctx as any).connectRequest?.headers?.[RealIpHeader] as string | undefined) ??
      (ctx.clientToProxyRequest?.headers?.[RealIpHeader] as string | undefined) ??
      ctx.clientToProxyRequest?.socket?.remoteAddress

    const placeholders = this.findPlaceholders(sourceIp)

    // Strip the internal tracking header so it's never forwarded externally
    const outHeaders = ctx.proxyToServerRequestOptions?.headers
    if (outHeaders) delete outHeaders[RealIpHeader]

    if (!placeholders) return

    // Extract destination host, strip port
    const rawHost = ctx.proxyToServerRequestOptions?.host
    const destHost = rawHost?.split(`:`)[0] || undefined

    if (!destHost) {
      const hasDomainGated = Object.values(placeholders).some(
        (e) => e.allowedDomains?.length
      )
      if (hasDomainGated)
        logger.warn(
          `[EgressProxy] Could not determine destination host — domain-gated swaps will be skipped`
        )
    }

    // Scan and replace Authorization header
    const authHeader = outHeaders?.[`authorization`]
    if (authHeader) {
      const header = isArr(authHeader) ? authHeader[0] : authHeader
      const replaced = await this.replaceTokens(header, placeholders, destHost)
      if (replaced !== authHeader)
        ctx.proxyToServerRequestOptions!.headers[`authorization`] = replaced
    }

    // Scan and replace other headers that may contain placeholders
    const headers = outHeaders || {}
    for (const [key, value] of Object.entries(headers)) {
      if (isStr(value) && value.includes(PhTokenPrefix))
        headers[key] = await this.replaceTokens(value, placeholders, destHost)
    }
  }

  private findPlaceholders(sourceIp?: string): TPlaceholderMap | null {
    if (!sourceIp) return null

    // Normalize IPv6-mapped IPv4 (::ffff:10.0.0.5 → 10.0.0.5) for comparison
    const normalized = sourceIp.replace(/^::ffff:/, ``)

    for (const route of Object.values(this.routes)) {
      if (route.meta.podIp === normalized || route.meta.podIp === sourceIp) {
        const entries = Object.entries(route.placeholders)
        return entries.length > 0 ? route.placeholders : null
      }
    }
    return null
  }

  private async replaceTokens(
    value: string,
    placeholders: TPlaceholderMap,
    destHost?: string
  ): Promise<string> {
    let result = value
    for (const [token, entry] of Object.entries(placeholders)) {
      if (!result.includes(token)) continue

      // Domain-gate: skip swap if allowedDomains is set and destination doesn't match
      if (entry.allowedDomains?.length) {
        if (!destHost || !isDomainAllowed(destHost, entry.allowedDomains)) {
          logger.info(
            `[EgressProxy] Skipping placeholder swap for ${token.slice(0, 12)}… — destination ${destHost || `unknown`} not in allowedDomains`
          )
          continue
        }
      }

      const secret = await this.resolveSecret(entry.secretId)
      if (secret) {
        result = result.replaceAll(token, secret)
      } else {
        throw new Error(
          `[EgressProxy] Failed to resolve secret ${entry.secretId} for placeholder ${token.slice(0, 12)}…`
        )
      }
    }
    return result
  }

  /**
   * Handle a single connection from the front TCP server.
   * Peeks at the first bytes to determine protocol, then routes accordingly.
   */
  private handleConnection(clientSocket: net.Socket): void {
    clientSocket.once(`data`, (firstChunk: Buffer) => {
      if (firstChunk[0] === 0x16) {
        this.handleTLSConnection(clientSocket, firstChunk)
      } else {
        this.handleHTTPConnection(clientSocket, firstChunk)
      }
    })

    clientSocket.on(`error`, (err) => {
      logger.debug(`[EgressProxy] Client socket error:`, err.message)
    })
  }

  /**
   * Pipe an HTTP connection directly to the internal MITM proxy.
   * Injects X-TDSK-Real-IP header so handleRequest can identify the sandbox pod.
   */
  private handleHTTPConnection(clientSocket: net.Socket, firstChunk: Buffer): void {
    const realIp = clientSocket.remoteAddress || ``
    const mitmSocket = net.connect(this.mitmPort, `127.0.0.1`, () => {
      // Inject real client IP header after the HTTP request line
      const crlfPos = firstChunk.indexOf(`\r\n`)
      if (crlfPos > 0) {
        const headerLine = Buffer.from(`${RealIpHeader}: ${realIp}\r\n`)
        const modified = Buffer.concat([
          firstChunk.subarray(0, crlfPos + 2),
          headerLine,
          firstChunk.subarray(crlfPos + 2),
        ])
        mitmSocket.write(modified)
      } else {
        mitmSocket.write(firstChunk)
      }
      clientSocket.pipe(mitmSocket)
      mitmSocket.pipe(clientSocket)
    })
    mitmSocket.on(`error`, () => clientSocket.destroy())
    clientSocket.on(`error`, () => mitmSocket.destroy())
  }

  /**
   * Convert a transparent TLS connection into an HTTP CONNECT tunnel.
   * Extracts the SNI hostname from the ClientHello, sends CONNECT to the
   * MITM proxy, waits for 200, then forwards the original TLS data.
   * Includes X-TDSK-Real-IP header so handleRequest can identify the sandbox pod.
   */
  private handleTLSConnection(clientSocket: net.Socket, firstChunk: Buffer): void {
    const sni = extractSNI(firstChunk) || `unknown`
    const realIp = clientSocket.remoteAddress || ``

    const mitmSocket = net.connect(this.mitmPort, `127.0.0.1`, () => {
      mitmSocket.write(
        `CONNECT ${sni}:443 HTTP/1.1\r\nHost: ${sni}:443\r\n${RealIpHeader}: ${realIp}\r\n\r\n`
      )
    })

    mitmSocket.once(`data`, (response: Buffer) => {
      if (response.toString().includes(`200`)) {
        mitmSocket.write(firstChunk)
        clientSocket.pipe(mitmSocket)
        mitmSocket.pipe(clientSocket)
      } else {
        logger.error(
          `[EgressProxy] CONNECT rejected for ${sni}:`,
          response.toString().trim()
        )
        clientSocket.destroy()
        mitmSocket.destroy()
      }
    })

    mitmSocket.on(`error`, () => clientSocket.destroy())
    clientSocket.on(`error`, () => mitmSocket.destroy())
  }

  async start(): Promise<void> {
    // Step 0: Prepare sslCaDir with our CA in http-mitm-proxy's expected layout
    this.sslCaDir = this.prepareCaDir()

    // Step 1: Start MITM proxy on internal loopback port (random)
    await new Promise<void>((resolve, reject) => {
      let started = false

      this.proxy.onError((ctx, err) => {
        if (!started) {
          started = true
          reject(err)
        } else {
          logger.error(`[EgressProxy] Proxy error:`, err)
        }
      })

      try {
        this.proxy.listen({ port: 0, host: `127.0.0.1`, sslCaDir: this.sslCaDir }, () => {
          started = true
          this.mitmPort = (this.proxy as any).httpPort
          logger.debug(`[EgressProxy] MITM proxy on internal port ${this.mitmPort}`)
          resolve()
        })
      } catch (err) {
        reject(err as Error)
      }
    })

    // Step 2: Start front TCP server on the public port with protocol sniffing
    await new Promise<void>((resolve, reject) => {
      this.frontServer = net.createServer((socket) => this.handleConnection(socket))

      this.frontServer.on(`error`, (err) => {
        logger.error(`[EgressProxy] Front server error:`, err)
        reject(err)
      })

      this.frontServer.listen(this.port, `0.0.0.0`, () => {
        logger.log(`[EgressProxy] Listening on port ${this.port}`)
        resolve()
      })
    })
  }

  stop(): void {
    if (this.frontServer) {
      this.frontServer.close()
      this.frontServer = null
    }
    this.proxy.close()
    if (this.sslCaDir) {
      fs.rmSync(this.sslCaDir, { recursive: true, force: true })
      this.sslCaDir = null
    }
  }
}
