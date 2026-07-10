import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'

import { Exception } from '@tdsk/domain'

/**
 * SSRF egress guard for the proxy engine.
 *
 * The proxy (and the agent `context.connect` capability that reuses it) makes a
 * server-side `fetch` from INSIDE the K8s cluster with reach to link-local
 * metadata (169.254.169.254), the K8s API, cluster-internal services, and the
 * backend itself — all with endpoint secrets attached. Nothing else in the stack
 * restricts that egress (the endpoint `domainWhitelist` validates the INBOUND
 * request origin, not the outbound target). This guard is that missing control:
 * it refuses any target that resolves to a private/loopback/link-local address
 * or a cluster-internal name, closing the credentialed-SSRF hole for both the
 * existing `/proxy` path and the new connector path.
 *
 * DNS is resolved and EVERY returned address is checked, so a public name that
 * resolves to a private IP (DNS-rebinding) is refused too.
 */

/** Injectable resolver so tests need no real DNS. Returns resolved addresses. */
export type TEgressResolver = (host: string) => Promise<string[]>

const defaultResolver: TEgressResolver = async (host) => {
  const results = await lookup(host, { all: true })
  return results.map((r) => r.address)
}

/** Parse a dotted IPv4 string into a 32-bit int, or null if malformed. */
const ipv4ToInt = (ip: string): number | null => {
  const parts = ip.split(`.`)
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    value = value * 256 + octet
  }
  return value >>> 0
}

/** [network, maskBits] CIDRs that must never be reached from a proxied call. */
const BlockedV4Cidrs: Array<[string, number]> = [
  [`0.0.0.0`, 8], // "this" network / unspecified
  [`10.0.0.0`, 8], // RFC1918 private
  [`100.64.0.0`, 10], // CGNAT
  [`127.0.0.0`, 8], // loopback
  [`169.254.0.0`, 16], // link-local — cloud metadata (169.254.169.254)
  [`172.16.0.0`, 12], // RFC1918 private
  [`192.0.0.0`, 24], // IETF protocol assignments
  [`192.168.0.0`, 16], // RFC1918 private
  [`198.18.0.0`, 15], // benchmarking
  [`224.0.0.0`, 4], // multicast
  [`240.0.0.0`, 4], // reserved
]

const inCidr = (ipInt: number, network: string, bits: number): boolean => {
  const netInt = ipv4ToInt(network)
  if (netInt === null) return false
  if (bits === 0) return true
  const mask = (0xffffffff << (32 - bits)) >>> 0
  return (ipInt & mask) === (netInt & mask)
}

const isBlockedV4 = (ip: string): boolean => {
  const ipInt = ipv4ToInt(ip)
  if (ipInt === null) return true // unparseable → fail closed
  return BlockedV4Cidrs.some(([net, bits]) => inCidr(ipInt, net, bits))
}

const isBlockedV6 = (raw: string): boolean => {
  const ip = raw.toLowerCase().replace(/^\[|\]$/g, ``)
  // IPv4-mapped / -embedded (::ffff:a.b.c.d, ::a.b.c.d) → judge by the v4 part
  const v4 = ip.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (v4) return isBlockedV4(v4[1])
  if (ip === `::1` || ip === `::`) return true // loopback / unspecified
  if (
    ip.startsWith(`fe8`) ||
    ip.startsWith(`fe9`) ||
    ip.startsWith(`fea`) ||
    ip.startsWith(`feb`)
  )
    return true // fe80::/10 link-local
  if (ip.startsWith(`fc`) || ip.startsWith(`fd`)) return true // fc00::/7 ULA
  if (ip.startsWith(`ff`)) return true // multicast
  return false
}

const isBlockedIp = (ip: string): boolean =>
  isIP(ip) === 6 ? isBlockedV6(ip) : isBlockedV4(ip)

/**
 * Names that resolve to cluster-internal endpoints — refused before DNS even
 * runs. Bare single-label hosts (no dot, e.g. `tdsk-backend`) are cluster
 * service names inside the pod's search domain, so they are refused too.
 */
const isInternalName = (host: string): boolean => {
  const h = host.toLowerCase().replace(/\.$/, ``)
  if (h === `localhost`) return true
  if (!h.includes(`.`)) return true // single-label → cluster service name
  return (
    h.endsWith(`.local`) ||
    h.endsWith(`.internal`) ||
    h.endsWith(`.cluster.local`) ||
    h.endsWith(`.svc`) ||
    h.includes(`.svc.`)
  )
}

/**
 * Throw (Exception 403) unless `host` is a safe public egress target. Applies to
 * a literal IP directly; for a name, refuses obvious internal names then resolves
 * DNS and refuses if ANY resolved address is private/loopback/link-local.
 */
export const assertPublicEgressHost = async (
  host: string,
  resolver: TEgressResolver = defaultResolver
): Promise<void> => {
  const hostname = (host || ``).trim().replace(/^\[|\]$/g, ``)
  if (!hostname) throw new Exception(400, `Egress target has no host`)

  // Literal IP — check directly, no DNS.
  if (isIP(hostname)) {
    if (isBlockedIp(hostname))
      throw new Exception(403, `Egress to non-public address is blocked: ${hostname}`)
    return
  }

  if (isInternalName(hostname))
    throw new Exception(403, `Egress to cluster-internal host is blocked: ${hostname}`)

  let addresses: string[]
  try {
    addresses = await resolver(hostname)
  } catch {
    throw new Exception(502, `Egress host did not resolve: ${hostname}`)
  }
  if (!addresses.length)
    throw new Exception(502, `Egress host did not resolve: ${hostname}`)

  for (const addr of addresses)
    if (isBlockedIp(addr))
      throw new Exception(
        403,
        `Egress host ${hostname} resolves to a non-public address (${addr}) — blocked`
      )
}

/**
 * Guard a full URL string: require an http(s) scheme and a public host. Use this
 * at every proxied-fetch site (initial target AND every redirect target).
 */
export const assertSafeEgressUrl = async (
  rawUrl: string,
  resolver: TEgressResolver = defaultResolver
): Promise<void> => {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Exception(400, `Invalid egress URL: ${rawUrl}`)
  }
  if (url.protocol !== `https:` && url.protocol !== `http:`)
    throw new Exception(400, `Egress scheme not allowed: ${url.protocol}`)
  await assertPublicEgressHost(url.hostname, resolver)
}

/**
 * `fetch` that guards EVERY hop against the egress guard. Redirects are followed
 * MANUALLY — `fetch`'s built-in `redirect: 'follow'` would chase a 3xx chain to
 * an internal host with no check — so each `Location` is guarded before the next
 * request. Bounded hop count. Use this instead of a bare `fetch` anywhere the
 * target is (even indirectly) influenced by a proxied/agent-driven request.
 */
export const guardedFetch = async (
  rawUrl: string,
  init: RequestInit = {},
  resolver: TEgressResolver = defaultResolver,
  maxRedirects = 5
): Promise<Response> => {
  let current = rawUrl
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertSafeEgressUrl(current, resolver)
    const res = await fetch(current, { ...init, redirect: `manual` })
    const location = res.status >= 300 && res.status < 400 && res.headers.get(`location`)
    if (!location) return res
    current = new URL(location, current).toString()
  }
  throw new Exception(502, `Too many redirects from egress target`)
}
