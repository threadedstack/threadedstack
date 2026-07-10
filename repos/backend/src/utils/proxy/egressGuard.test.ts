import { describe, it, expect, vi, afterEach } from 'vitest'

import { assertPublicEgressHost, assertSafeEgressUrl, guardedFetch } from './egressGuard'

/** A resolver that maps names to fixed addresses (no real DNS in tests). */
const resolverFor =
  (map: Record<string, string[]>) =>
  async (host: string): Promise<string[]> => {
    if (host in map) return map[host]
    throw new Error(`no record for ${host}`)
  }

const publicResolver = resolverFor({ 'api.stripe.com': [`3.4.5.6`] })

describe(`egressGuard.assertPublicEgressHost`, () => {
  it(`allows a public literal IP`, async () => {
    await expect(assertPublicEgressHost(`8.8.8.8`)).resolves.toBeUndefined()
  })

  it(`allows a public hostname that resolves to a public IP`, async () => {
    await expect(
      assertPublicEgressHost(`api.stripe.com`, publicResolver)
    ).resolves.toBeUndefined()
  })

  it.each([
    [`127.0.0.1`, `loopback`],
    [`10.1.2.3`, `RFC1918 10/8`],
    [`172.16.5.4`, `RFC1918 172.16/12`],
    [`172.31.255.255`, `RFC1918 172.16/12 upper`],
    [`192.168.0.1`, `RFC1918 192.168/16`],
    [`169.254.169.254`, `cloud metadata link-local`],
    [`0.0.0.0`, `unspecified`],
    [`100.64.1.1`, `CGNAT`],
  ])(`blocks private IPv4 %s (%s)`, async (ip) => {
    await expect(assertPublicEgressHost(ip)).rejects.toMatchObject({ status: 403 })
  })

  it(`does NOT block a public IPv4 adjacent to a private range (172.32.0.1)`, async () => {
    await expect(assertPublicEgressHost(`172.32.0.1`)).resolves.toBeUndefined()
    await expect(assertPublicEgressHost(`172.15.255.255`)).resolves.toBeUndefined()
  })

  it.each([
    [`::1`, `loopback`],
    [`fe80::1`, `link-local`],
    [`fc00::1`, `ULA`],
    [`fd12:3456::1`, `ULA`],
    [`::ffff:127.0.0.1`, `v4-mapped loopback`],
    [`::ffff:10.0.0.1`, `v4-mapped private`],
    // BLOCKER-1 regression: hex / alternate encodings of the SAME address must
    // be canonicalized and blocked (previously bypassed a string-match guard).
    [`::ffff:a9fe:a9fe`, `v4-mapped metadata in HEX (169.254.169.254)`],
    [`0:0:0:0:0:ffff:a9fe:a9fe`, `fully-expanded v4-mapped metadata`],
    [`64:ff9b::a9fe:a9fe`, `NAT64-embedded metadata`],
    [`2002:a9fe:a9fe::1`, `6to4-embedded metadata`],
    [`2002:0a00:0001::1`, `6to4-embedded private 10.0.0.1`],
    [`0::1`, `loopback via alternate zero-compression`],
    [`::ffff:169.254.169.254`, `v4-mapped metadata dotted`],
    [`FE80::1`, `link-local uppercase`],
  ])(`blocks private IPv6 %s (%s)`, async (ip) => {
    await expect(assertPublicEgressHost(ip)).rejects.toMatchObject({ status: 403 })
  })

  it(`allows a genuine public IPv6`, async () => {
    await expect(assertPublicEgressHost(`2606:4700:4700::1111`)).resolves.toBeUndefined()
  })

  it.each([
    [`localhost`],
    [`tdsk-backend`], // single-label cluster service
    [`tdsk-backend.tdsk-production.svc.cluster.local`],
    [`kubernetes.default.svc`],
    [`something.internal`],
    [`printer.local`],
  ])(`blocks cluster-internal name %s`, async (host) => {
    await expect(assertPublicEgressHost(host, publicResolver)).rejects.toMatchObject({
      status: 403,
    })
  })

  it(`blocks DNS-rebinding: a public name that resolves to a private IP`, async () => {
    const rebind = resolverFor({ 'evil.example.com': [`169.254.169.254`] })
    await expect(
      assertPublicEgressHost(`evil.example.com`, rebind)
    ).rejects.toMatchObject({ status: 403 })
  })

  it(`blocks if ANY resolved address is private (mixed public+private)`, async () => {
    const mixed = resolverFor({ 'evil.example.com': [`3.4.5.6`, `10.0.0.5`] })
    await expect(assertPublicEgressHost(`evil.example.com`, mixed)).rejects.toMatchObject(
      { status: 403 }
    )
  })

  it(`fails closed when the host does not resolve`, async () => {
    await expect(
      assertPublicEgressHost(`nope.example.com`, resolverFor({}))
    ).rejects.toMatchObject({ status: 502 })
  })

  it(`rejects an empty host`, async () => {
    await expect(assertPublicEgressHost(``)).rejects.toMatchObject({ status: 400 })
  })
})

describe(`egressGuard.assertSafeEgressUrl`, () => {
  it(`allows a public https URL`, async () => {
    await expect(
      assertSafeEgressUrl(`https://api.stripe.com/v1/charges`, publicResolver)
    ).resolves.toBeUndefined()
  })

  it(`blocks a URL whose host is private`, async () => {
    await expect(
      assertSafeEgressUrl(`http://169.254.169.254/latest/meta-data/`)
    ).rejects.toMatchObject({ status: 403 })
  })

  it.each([[`file:///etc/passwd`], [`gopher://127.0.0.1`], [`ftp://internal`]])(
    `blocks non-http(s) scheme %s`,
    async (url) => {
      await expect(assertSafeEgressUrl(url, publicResolver)).rejects.toMatchObject({
        status: 400,
      })
    }
  )

  it(`rejects a malformed URL`, async () => {
    await expect(assertSafeEgressUrl(`not a url`)).rejects.toMatchObject({ status: 400 })
  })
})

describe(`egressGuard.guardedFetch`, () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it(`refuses a private target before any network call`, async () => {
    const spy = vi.fn()
    vi.stubGlobal(`fetch`, spy)
    await expect(
      guardedFetch(`http://169.254.169.254/latest/meta-data/`, {}, publicResolver)
    ).rejects.toMatchObject({ status: 403 })
    expect(spy).not.toHaveBeenCalled() // never touched the network
  })

  it(`returns a non-redirect response from a public host`, async () => {
    vi.stubGlobal(
      `fetch`,
      vi.fn(async () => new Response(`ok`, { status: 200 }))
    )
    const res = await guardedFetch(`https://api.stripe.com/x`, {}, publicResolver)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(`ok`)
  })

  it(`BLOCKS a public host that 302-redirects to an internal host`, async () => {
    // first hop: public host returns a 302 pointing at the metadata service
    const spy = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: `http://169.254.169.254/` },
        })
    )
    vi.stubGlobal(`fetch`, spy)
    await expect(
      guardedFetch(`https://api.stripe.com/x`, {}, publicResolver)
    ).rejects.toMatchObject({ status: 403 })
    expect(spy).toHaveBeenCalledTimes(1) // stopped at the guarded redirect, didn't chase it
  })

  it(`caps redirect hops`, async () => {
    vi.stubGlobal(
      `fetch`,
      vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: `https://api.stripe.com/next` },
          })
      )
    )
    await expect(
      guardedFetch(`https://api.stripe.com/x`, {}, publicResolver, 3)
    ).rejects.toMatchObject({ status: 502 })
  })
})
