import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { DefaultVerifyProbe } from '@tdsk/domain'
import {
  probeFromPrBody,
  parseVerifyResultsBlock,
  verifyDeploy,
  verifyDeploymentsReady,
} from './verify'

const fence = (label: string, body: string) => `\`\`\`${label}\n${body}\n\`\`\``

describe(`probeFromPrBody`, () => {
  it(`parses a valid tdsk-verify block with kind and params`, () => {
    const probe = { kind: `health`, params: { url: `/_/health` } }
    const body = `Some PR description\n${fence(`tdsk-verify`, JSON.stringify(probe))}`
    const result = probeFromPrBody(body)
    expect(result).toEqual({ kind: `health`, params: { url: `/_/health` } })
  })

  it(`returns DefaultVerifyProbe when no block is present`, () => {
    const result = probeFromPrBody(`no fenced block here`)
    expect(result).toEqual(DefaultVerifyProbe)
  })

  it(`returns DefaultVerifyProbe when block contains malformed JSON`, () => {
    const body = fence(`tdsk-verify`, `{not valid json`)
    const result = probeFromPrBody(body)
    expect(result).toEqual(DefaultVerifyProbe)
  })

  it(`returns DefaultVerifyProbe when kind is not a valid EVerifyProbeKind value`, () => {
    const probe = { kind: `nonsense`, params: { url: `/_/health` } }
    const body = fence(`tdsk-verify`, JSON.stringify(probe))
    const result = probeFromPrBody(body)
    expect(result).toEqual(DefaultVerifyProbe)
  })

  it(`accepts an array containing one probe object (leniency — uses first element)`, () => {
    const probe = { kind: `ci-green` }
    const body = fence(`tdsk-verify`, JSON.stringify([probe]))
    const result = probeFromPrBody(body)
    expect(result).toEqual({ kind: `ci-green` })
  })

  it(`uses the LAST tdsk-verify block when two blocks are present`, () => {
    const first = fence(
      `tdsk-verify`,
      JSON.stringify({ kind: `health`, params: { url: `/first` } })
    )
    const second = fence(`tdsk-verify`, JSON.stringify({ kind: `marker-advanced` }))
    const body = `${first}\nsome text\n${second}`
    const result = probeFromPrBody(body)
    expect(result).toEqual({ kind: `marker-advanced` })
  })

  it(`returns probe without params when params is absent`, () => {
    const probe = { kind: `ci-green` }
    const body = fence(`tdsk-verify`, JSON.stringify(probe))
    const result = probeFromPrBody(body)
    expect(result).toEqual({ kind: `ci-green` })
    expect(`params` in result).toBe(false)
  })

  it(`accepts all valid EVerifyProbeKind values`, () => {
    const kinds = [`health`, `ci-green`, `marker-advanced`, `assertion`]
    for (const kind of kinds) {
      const body = fence(`tdsk-verify`, JSON.stringify({ kind }))
      const result = probeFromPrBody(body)
      expect(result.kind).toBe(kind)
    }
  })
})

describe(`parseVerifyResultsBlock`, () => {
  it(`parses a valid results array with all entries`, () => {
    const results = [
      {
        prNumber: 42,
        status: `verified`,
        mergeSha: `abc123`,
        detail: `all good`,
        revertPrUrl: `https://github.com/org/repo/pull/43`,
      },
      { prNumber: 7, status: `regressed`, detail: `health check failed` },
    ]
    const text = fence(`tdsk-verify-results`, JSON.stringify(results))
    const parsed = parseVerifyResultsBlock(text)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toEqual({
      prNumber: 42,
      status: `verified`,
      mergeSha: `abc123`,
      detail: `all good`,
      revertPrUrl: `https://github.com/org/repo/pull/43`,
    })
    expect(parsed[1]).toEqual({
      prNumber: 7,
      status: `regressed`,
      detail: `health check failed`,
    })
  })

  it(`drops an entry with missing prNumber`, () => {
    const results = [{ status: `verified` }, { prNumber: 5, status: `verified` }]
    const text = fence(`tdsk-verify-results`, JSON.stringify(results))
    const parsed = parseVerifyResultsBlock(text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].prNumber).toBe(5)
  })

  it(`drops an entry with a status that is not 'verified' or 'regressed'`, () => {
    const results = [
      { prNumber: 1, status: `pending` },
      { prNumber: 2, status: `unknown` },
      { prNumber: 3, status: `verified` },
    ]
    const text = fence(`tdsk-verify-results`, JSON.stringify(results))
    const parsed = parseVerifyResultsBlock(text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].prNumber).toBe(3)
  })

  it(`coerces prNumber from a string of digits via Number() and keeps the entry`, () => {
    const results = [{ prNumber: `99`, status: `regressed` }]
    const text = fence(`tdsk-verify-results`, JSON.stringify(results))
    const parsed = parseVerifyResultsBlock(text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].prNumber).toBe(99)
    expect(typeof parsed[0].prNumber).toBe(`number`)
  })

  it(`returns [] for malformed JSON in the block`, () => {
    const text = fence(`tdsk-verify-results`, `{bad json here`)
    expect(parseVerifyResultsBlock(text)).toEqual([])
  })

  it(`uses the LAST tdsk-verify-results block (last-block-wins)`, () => {
    const first = fence(
      `tdsk-verify-results`,
      JSON.stringify([{ prNumber: 1, status: `verified` }])
    )
    const second = fence(
      `tdsk-verify-results`,
      JSON.stringify([{ prNumber: 2, status: `regressed` }])
    )
    const text = `${first}\nsome text\n${second}`
    const parsed = parseVerifyResultsBlock(text)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].prNumber).toBe(2)
    expect(parsed[0].status).toBe(`regressed`)
  })

  it(`returns [] for a missing block`, () => {
    expect(parseVerifyResultsBlock(`no fenced block here`)).toEqual([])
  })

  it(`drops optional fields (mergeSha, detail, revertPrUrl) when empty or missing`, () => {
    const results = [{ prNumber: 10, status: `verified`, mergeSha: ``, detail: `` }]
    const text = fence(`tdsk-verify-results`, JSON.stringify(results))
    const parsed = parseVerifyResultsBlock(text)
    expect(parsed).toHaveLength(1)
    expect(`mergeSha` in parsed[0]).toBe(false)
    expect(`detail` in parsed[0]).toBe(false)
    expect(`revertPrUrl` in parsed[0]).toBe(false)
  })

  it(`drops an entry with prNumber 0 (not a positive integer)`, () => {
    const results = [{ prNumber: 0, status: `verified` }]
    const text = fence(`tdsk-verify-results`, JSON.stringify(results))
    expect(parseVerifyResultsBlock(text)).toEqual([])
  })
})

// ─── verifyDeploy & verifyDeploymentsReady ────────────────────────────────────

/** Minimal TApp mock. kube.readDeployment is overridden per-test. */
const makeApp = (readDeploymentImpl?: (name: string) => Promise<any>) => ({
  locals: {
    kube: {
      readDeployment: readDeploymentImpl ?? vi.fn(),
    },
  },
})

/** Build a mock fetch that returns a JSON body with a given HTTP status code. */
const mockFetch = (status: number, body: Record<string, any>) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })

/** Build a mock fetch that rejects with an error (network failure). */
const mockFetchError = (message: string) => vi.fn().mockRejectedValue(new Error(message))

describe(`verifyDeploy`, () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it(`health probe on production returns green when body.status is ok`, async () => {
    globalThis.fetch = mockFetch(200, { status: `ok` })
    const app = makeApp()
    const result = await verifyDeploy(app as any, {
      env: `production`,
      probes: [{ kind: `health` }],
    })
    expect(result.green).toBe(true)
    expect(result.failures).toHaveLength(0)
    expect(result.results).toHaveLength(1)
    expect(result.results[0].passed).toBe(true)
    // Must target the production proxy host
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string
    expect(calledUrl).toContain(`px.threadedstack.app`)
  })

  it(`health probe fails when body.status is not ok`, async () => {
    globalThis.fetch = mockFetch(200, { status: `degraded` })
    const app = makeApp()
    const result = await verifyDeploy(app as any, {
      env: `production`,
      probes: [{ kind: `health` }],
    })
    expect(result.green).toBe(false)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].detail).toContain(`degraded`)
    expect(result.failures[0].detail).toContain(`expected 'ok'`)
  })

  it(`health probe fails with HTTP 500`, async () => {
    globalThis.fetch = mockFetch(500, {})
    const app = makeApp()
    const result = await verifyDeploy(app as any, {
      env: `production`,
      probes: [{ kind: `health` }],
    })
    expect(result.green).toBe(false)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].detail).toContain(`HTTP 500`)
  })

  it(`health probe fails when fetch throws a network error`, async () => {
    globalThis.fetch = mockFetchError(`ECONNREFUSED`)
    const app = makeApp()
    const result = await verifyDeploy(app as any, {
      env: `production`,
      probes: [{ kind: `health` }],
    })
    expect(result.green).toBe(false)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].detail).toContain(`ECONNREFUSED`)
  })

  it(`marker-advanced probe passes when deployedSha matches mergeSha`, async () => {
    const app = makeApp(async (_name: string) => ({
      name: `tdsk-backend`,
      replicas: { desired: 1, ready: 1, available: 1, updated: 1 },
      image: `ghcr.io/org/repo:sha-abc1234`,
      revision: `5`,
      conditions: [],
    }))
    const result = await verifyDeploy(app as any, {
      env: `production`,
      probes: [{ kind: `marker-advanced`, params: { mergeSha: `abc1234` } }],
    })
    expect(result.green).toBe(true)
    expect(result.failures).toHaveLength(0)
    expect(result.results[0].detail).toContain(`deployedSha=abc1234`)
  })

  it(`marker-advanced probe fails when deployedSha does not match mergeSha`, async () => {
    const app = makeApp(async (_name: string) => ({
      name: `tdsk-backend`,
      replicas: { desired: 1, ready: 1, available: 1, updated: 1 },
      image: `ghcr.io/org/repo:sha-deadbeef`,
      revision: `4`,
      conditions: [],
    }))
    const result = await verifyDeploy(app as any, {
      env: `production`,
      probes: [{ kind: `marker-advanced`, params: { mergeSha: `abc1234` } }],
    })
    expect(result.green).toBe(false)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].detail).toContain(`deadbeef`)
    expect(result.failures[0].detail).toContain(`abc1234`)
  })

  it(`ci-green probe returns passed:false with in-pod detail (not a hard error)`, async () => {
    const app = makeApp()
    const result = await verifyDeploy(app as any, {
      env: `production`,
      probes: [{ kind: `ci-green` }],
    })
    expect(result.results).toHaveLength(1)
    expect(result.results[0].passed).toBe(false)
    expect(result.results[0].detail).toContain(`in-pod`)
  })

  it(`assertion probe returns passed:false with in-pod detail`, async () => {
    const app = makeApp()
    const result = await verifyDeploy(app as any, {
      env: `production`,
      probes: [{ kind: `assertion` }],
    })
    expect(result.results).toHaveLength(1)
    expect(result.results[0].passed).toBe(false)
    expect(result.results[0].detail).toContain(`in-pod`)
  })

  it(`mixed probes: 2 passing health + 1 ci-green => green:false, 1 failure`, async () => {
    // Two separate fetch calls for the two health probes
    let callCount = 0
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: `ok` }),
      })
    })
    const app = makeApp()
    const result = await verifyDeploy(app as any, {
      env: `production`,
      probes: [
        { kind: `health`, params: { url: `/health` } },
        { kind: `health`, params: { url: `/_/health` } },
        { kind: `ci-green` },
      ],
    })
    expect(result.results).toHaveLength(3)
    expect(result.green).toBe(false)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].probe.kind).toBe(`ci-green`)
  })
})

describe(`verifyDeploymentsReady`, () => {
  it(`returns ready:true when all 5 default deployments report ready === desired`, async () => {
    const readDeployment = vi.fn().mockImplementation(async (name: string) => ({
      name,
      replicas: { desired: 2, ready: 2, available: 2, updated: 2 },
      image: `ghcr.io/org/repo:sha-abc1234`,
      revision: `1`,
      conditions: [],
    }))
    const app = makeApp(readDeployment)
    const result = await verifyDeploymentsReady(app as any, {})
    expect(result.ready).toBe(true)
    expect(result.failures).toHaveLength(0)
    // All 5 OpsAllowedDeployments
    expect(result.detail).toHaveLength(5)
  })

  it(`returns ready:false and lists the failing deployment when ready < desired`, async () => {
    const readDeployment = vi.fn().mockImplementation(async (name: string) => {
      if (name === `tdsk-backend`) {
        return {
          name,
          replicas: { desired: 2, ready: 1, available: 1, updated: 1 },
          image: `ghcr.io/org/repo:sha-abc1234`,
          revision: `2`,
          conditions: [],
        }
      }
      return {
        name,
        replicas: { desired: 1, ready: 1, available: 1, updated: 1 },
        image: `ghcr.io/org/repo:sha-abc1234`,
        revision: `1`,
        conditions: [],
      }
    })
    const app = makeApp(readDeployment)
    const result = await verifyDeploymentsReady(app as any, {})
    expect(result.ready).toBe(false)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]).toContain(`tdsk-backend`)
    expect(result.failures[0]).toContain(`1/2`)
  })
})
