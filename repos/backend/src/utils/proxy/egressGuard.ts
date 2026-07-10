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
 * DNS is resolved at CHECK time and EVERY returned address is validated, so a
 * name that currently resolves to a private/internal IP is refused. This is
 * resolve-time validation, NOT socket-level IP pinning: a name that answers a
 * public IP to this lookup but a private IP to the subsequent connect (a fast
 * DNS-rebinding race) is a residual the check cannot close on its own. That
 * window is bounded in practice because the target host is not attacker-chosen —
 * on `/proxy` it is the admin-configured endpoint URL, and on the connector path
 * it must additionally be on the git-seeded per-endpoint connect-allowlist. True
 * socket pinning (dial the validated IP, keep the hostname for SNI/Host) is the
 * follow-up hardening; it needs a custom HTTP agent and is tracked separately.
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

const isBlockedV4Int = (ipInt: number): boolean =>
  BlockedV4Cidrs.some(([net, bits]) => inCidr(ipInt, net, bits))

const isBlockedV4 = (ip: string): boolean => {
  const ipInt = ipv4ToInt(ip)
  if (ipInt === null) return true // unparseable → fail closed
  return isBlockedV4Int(ipInt)
}

/**
 * Expand an IPv6 literal to its canonical eight 16-bit groups (handling `::`
 * zero-compression and a trailing embedded IPv4). Returns null on anything
 * malformed so callers fail closed. This is what makes classification robust to
 * hex vs dotted vs alternate-compression encodings of the SAME address —
 * `::ffff:169.254.169.254`, `::ffff:a9fe:a9fe`, and `0:0:0:0:0:ffff:a9fe:a9fe`
 * all expand to the same groups.
 */
const expandIPv6 = (raw: string): number[] | null => {
  let ip = raw.toLowerCase().replace(/^\[|\]$/g, ``)
  const zone = ip.indexOf(`%`)
  if (zone >= 0) ip = ip.slice(0, zone) // strip scope id
  // A trailing dotted-quad (embedded IPv4) → fold into two hex groups.
  const v4 = ip.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (v4) {
    const v4int = ipv4ToInt(v4[1])
    if (v4int === null) return null
    ip = `${ip.slice(0, v4.index)}${((v4int >>> 16) & 0xffff).toString(16)}:${(
      v4int & 0xffff
    ).toString(16)}`
  }
  const halves = ip.split(`::`)
  if (halves.length > 2) return null
  const toGroups = (s: string): number[] | null => {
    if (!s) return []
    const out: number[] = []
    for (const p of s.split(`:`)) {
      if (!/^[0-9a-f]{1,4}$/.test(p)) return null
      out.push(Number.parseInt(p, 16))
    }
    return out
  }
  const head = toGroups(halves[0])
  const tail = halves.length === 2 ? toGroups(halves[1]) : []
  if (head === null || tail === null) return null
  let groups: number[]
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length
    if (missing < 0) return null
    groups = [...head, ...Array(missing).fill(0), ...tail]
  } else {
    groups = head
  }
  return groups.length === 8 ? groups : null
}

const isBlockedV6 = (raw: string): boolean => {
  const g = expandIPv6(raw)
  if (!g) return true // unparseable → fail closed
  const embeddedV4 = ((g[6] << 16) | g[7]) >>> 0
  // ::ffff:a.b.c.d  (IPv4-mapped) → judge by the embedded v4
  if (
    g[0] === 0 &&
    g[1] === 0 &&
    g[2] === 0 &&
    g[3] === 0 &&
    g[4] === 0 &&
    g[5] === 0xffff
  )
    return isBlockedV4Int(embeddedV4)
  // 64:ff9b::/96  (NAT64) → judge by the embedded v4
  if (
    g[0] === 0x0064 &&
    g[1] === 0xff9b &&
    g[2] === 0 &&
    g[3] === 0 &&
    g[4] === 0 &&
    g[5] === 0
  )
    return isBlockedV4Int(embeddedV4)
  // 2002::/16  (6to4) → judge by the embedded v4 (groups 1-2)
  if (g[0] === 0x2002) return isBlockedV4Int(((g[1] << 16) | g[2]) >>> 0)
  // ::/96  (loopback ::1, unspecified ::, deprecated v4-compatible) — nothing
  // routable-public lives here, so block the whole block.
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0)
    return true
  const hb = g[0] >> 8
  if (hb === 0xfc || hb === 0xfd) return true // fc00::/7 unique-local
  if (g[0] >= 0xfe80 && g[0] <= 0xfebf) return true // fe80::/10 link-local
  if (hb === 0xff) return true // ff00::/8 multicast
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
