import { describe, it, expect, vi, beforeEach } from 'vitest'

import { EEndpointType } from '@tdsk/domain'

const mocks = vi.hoisted(() => ({
  applyAuth: vi.fn(async (sink: any) => sink.setHeader(`authorization`, `Bearer SECRET`)),
  applyOAuth: vi.fn(),
  addEndpointHeaders: vi.fn(),
  guardedFetch: vi.fn(
    async () =>
      new Response(JSON.stringify({ sent: true }), {
        status: 200,
        headers: { 'content-type': `application/json` },
      })
  ),
}))

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))
vi.mock(`@TBE/services/proxy`, () => ({
  ProxyService: vi.fn().mockImplementation(() => ({
    applyAuth: mocks.applyAuth,
    applyOAuth: mocks.applyOAuth,
  })),
}))
vi.mock(`@TBE/services/secrets/secretResolver`, () => ({
  SecretResolver: vi.fn().mockImplementation(() => ({
    decrypt: vi.fn(async () => `decrypted-secret`),
  })),
}))
vi.mock(`@TBE/utils/proxy`, () => ({
  guardedFetch: mocks.guardedFetch,
  addEndpointHeaders: mocks.addEndpointHeaders,
}))

import {
  createConnectorCapability,
  buildConnectorBridges,
  MaxConnectorCallsPerRun,
} from './connectorCapability'

const proxyEndpoint = (overrides: Record<string, any> = {}) => ({
  id: `ep_send1`,
  name: `sendEmail`,
  projectId: `p1`,
  type: EEndpointType.proxy,
  method: `POST`,
  headers: {},
  options: { url: `https://api.mail.example.com/send`, ...overrides.options },
  ...overrides,
})

const makeDb = (endpoint: any, secrets: any[] = [{ id: `sec_1`, orgId: `o1` }]) => ({
  services: {
    endpoint: {
      get: vi.fn(async (id: string) => ({
        data: endpoint && endpoint.id === id ? endpoint : null,
      })),
      list: vi.fn(async ({ where }: any) => ({
        data:
          endpoint &&
          endpoint.projectId === where.projectId &&
          endpoint.name === where.name
            ? [endpoint]
            : [],
      })),
    },
    secret: { list: vi.fn(async () => ({ data: secrets })) },
  },
})

// A db where the endpoint's referenced secret is scoped to the AGENT (not the
// project) — the shape produced when an agent authors its own secret.
const makeDbWithAgentSecret = (endpoint: any, agentId: string, agentSecret: any) => ({
  services: {
    endpoint: {
      get: vi.fn(async (id: string) => ({
        data: endpoint && endpoint.id === id ? endpoint : null,
      })),
      list: vi.fn(async ({ where }: any) => ({
        data:
          endpoint &&
          endpoint.projectId === where.projectId &&
          endpoint.name === where.name
            ? [endpoint]
            : [],
      })),
    },
    secret: {
      list: vi.fn(async ({ where }: any) => ({
        data: where.agentId === agentId ? [agentSecret] : [],
      })),
    },
  },
})

describe(`connectorCapability`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.applyAuth.mockImplementation(async (sink: any) =>
      sink.setHeader(`authorization`, `Bearer SECRET`)
    )
    mocks.guardedFetch.mockImplementation(
      async () =>
        new Response(JSON.stringify({ sent: true }), {
          status: 200,
          headers: { 'content-type': `application/json` },
        })
    )
  })

  it(`invokes a permitted proxy endpoint and returns the response (secrets host-side)`, async () => {
    const ep = proxyEndpoint({
      options: {
        url: `https://api.mail.example.com/send`,
        auth: { type: `bearer`, secretId: `sec_1` },
      },
    })
    const db = makeDb(ep) as any
    const cap = createConnectorCapability(db, `p1`, [`ep_send1`])

    const res = await cap.invoke(`ep_send1`, { body: { to: `x@y.com` } })

    expect(res).toEqual({ ok: true, status: 200, body: { sent: true } })
    expect(mocks.applyAuth).toHaveBeenCalledTimes(1)
    const [, init] = mocks.guardedFetch.mock.calls[0] as any
    expect(init.headers.authorization).toBe(`Bearer SECRET`)
    // the secret value is NOWHERE in what the isolate receives
    expect(JSON.stringify(res)).not.toContain(`SECRET`)
  })

  it(`resolves an endpoint by NAME within the project`, async () => {
    const db = makeDb(proxyEndpoint()) as any
    const cap = createConnectorCapability(db, `p1`, [`sendEmail`])
    const res = await cap.invoke(`sendEmail`, {})
    expect(res.ok).toBe(true)
  })

  it(`REFUSES an endpoint not on the allowlist`, async () => {
    const db = makeDb(proxyEndpoint()) as any
    const cap = createConnectorCapability(db, `p1`, [`ep_other`])
    const res = await cap.invoke(`ep_send1`, {})
    expect(res).toMatchObject({ ok: false })
    expect(res.error).toMatch(/not permitted/)
    expect(mocks.guardedFetch).not.toHaveBeenCalled()
  })

  it(`REFUSES a cross-project endpoint (project scope)`, async () => {
    const db = makeDb(proxyEndpoint({ projectId: `OTHER` })) as any
    const cap = createConnectorCapability(db, `p1`, [`ep_send1`, `sendEmail`])
    const res = await cap.invoke(`ep_send1`, {})
    expect(res).toMatchObject({ ok: false })
    expect(res.error).toMatch(/not found/)
  })

  it(`REFUSES a non-proxy endpoint`, async () => {
    const db = makeDb(proxyEndpoint({ type: EEndpointType.agent })) as any
    const cap = createConnectorCapability(db, `p1`, [`ep_send1`])
    const res = await cap.invoke(`ep_send1`, {})
    expect(res).toMatchObject({ ok: false })
    expect(res.error).toMatch(/only proxy/)
  })

  it(`REFUSES an endpoint that injects secrets into responses`, async () => {
    const ep = proxyEndpoint({
      options: {
        url: `https://api.mail.example.com/send`,
        transform: { injectSecrets: true },
      },
    })
    const db = makeDb(ep) as any
    const cap = createConnectorCapability(db, `p1`, [`ep_send1`])
    const res = await cap.invoke(`ep_send1`, {})
    expect(res).toMatchObject({ ok: false })
    expect(res.error).toMatch(/injects secrets/)
    expect(mocks.guardedFetch).not.toHaveBeenCalled()
  })

  it(`enforces the per-run call budget`, async () => {
    const db = makeDb(proxyEndpoint()) as any
    const cap = createConnectorCapability(db, `p1`, [`ep_send1`])
    for (let i = 0; i < MaxConnectorCallsPerRun; i++) {
      const ok = await cap.invoke(`ep_send1`, {})
      expect(ok.ok).toBe(true)
    }
    const over = await cap.invoke(`ep_send1`, {})
    expect(over).toMatchObject({ ok: false })
    expect(over.error).toMatch(/budget/)
  })

  it(`refuses a disallowed HTTP method`, async () => {
    const db = makeDb(proxyEndpoint()) as any
    const cap = createConnectorCapability(db, `p1`, [`ep_send1`])
    const res = await cap.invoke(`ep_send1`, { method: `TRACE` })
    expect(res).toMatchObject({ ok: false })
    expect(res.error).toMatch(/method not allowed/)
  })

  it(`returns a generic error (no secret leak) when the upstream call throws`, async () => {
    mocks.guardedFetch.mockRejectedValueOnce(
      new Error(`connect ECONNREFUSED 10.0.0.5:443`)
    )
    const db = makeDb(proxyEndpoint()) as any
    const cap = createConnectorCapability(db, `p1`, [`ep_send1`])
    const res = await cap.invoke(`ep_send1`, {})
    expect(res).toEqual({ ok: false, error: `connector call failed` })
    expect(res.error).not.toContain(`10.0.0.5`)
  })

  it(`buildConnectorBridges is fail-closed: no grant AND no caller → no bridge`, () => {
    const db = makeDb(proxyEndpoint()) as any
    expect(buildConnectorBridges(db, `p1`, [])).toEqual({})
    expect(Object.keys(buildConnectorBridges(db, `p1`, [`ep_send1`]))).toContain(
      `connect.invoke`
    )
    // an identified agent gets the bridge even with NO allowlist (it can reach
    // endpoints it authored via authorship=authorization)
    expect(
      Object.keys(buildConnectorBridges(db, `p1`, [], { agentId: `ag_ceo` }))
    ).toContain(`connect.invoke`)
  })

  it(`AUTHORSHIP is authorization: an agent reaches an endpoint IT authored with no allowlist`, async () => {
    const ep = proxyEndpoint({ meta: { authoredBy: `ag_ceo` } })
    const db = makeDb(ep) as any
    // empty allowlist, but the caller authored the endpoint
    const cap = createConnectorCapability(db, `p1`, [], { agentId: `ag_ceo` })
    const res = await cap.invoke(`ep_send1`, { body: { to: `x@y.com` } })
    expect(res).toEqual({ ok: true, status: 200, body: { sent: true } })
  })

  it(`an AUTHORED endpoint fetches secrets by AGENT scope only — never the project set (no cross-owner exfil)`, async () => {
    const ep = proxyEndpoint({ meta: { authoredBy: `ag_ceo` } })
    const db = makeDb(ep) as any
    const cap = createConnectorCapability(db, `p1`, [], { agentId: `ag_ceo` })
    await cap.invoke(`ep_send1`, {})
    const wheres = db.services.secret.list.mock.calls.map((c: any) => c[0]?.where)
    expect(wheres).toContainEqual({ agentId: `ag_ceo` })
    expect(wheres).not.toContainEqual({ projectId: `p1` })
  })

  it(`an ALLOWLISTED endpoint fetches PROJECT secrets (human-configured path)`, async () => {
    const ep = proxyEndpoint() // no meta.authoredBy
    const db = makeDb(ep) as any
    const cap = createConnectorCapability(db, `p1`, [`ep_send1`], { agentId: `ag_ceo` })
    await cap.invoke(`ep_send1`, {})
    const wheres = db.services.secret.list.mock.calls.map((c: any) => c[0]?.where)
    expect(wheres).toContainEqual({ projectId: `p1` })
    expect(wheres).not.toContainEqual({ agentId: `ag_ceo` })
  })

  it(`refuses an endpoint authored by a DIFFERENT agent when not allowlisted`, async () => {
    const ep = proxyEndpoint({ meta: { authoredBy: `ag_someone_else` } })
    const db = makeDb(ep) as any
    const cap = createConnectorCapability(db, `p1`, [], { agentId: `ag_ceo` })
    const res = await cap.invoke(`ep_send1`, {})
    expect(res).toMatchObject({ ok: false })
    expect(res.error).toMatch(/not permitted/)
    expect(mocks.guardedFetch).not.toHaveBeenCalled()
  })

  it(`resolves the CALLER's own agent-scoped secrets (secret it authored) for its endpoint`, async () => {
    const ep = proxyEndpoint({
      meta: { authoredBy: `ag_ceo` },
      options: {
        url: `https://api.mail.example.com/send`,
        auth: { type: `bearer`, secretId: `sec_agent` },
      },
    })
    // no project secrets; the agent's own secret is scoped by agentId
    const db = makeDbWithAgentSecret(ep, `ag_ceo`, {
      id: `sec_agent`,
      agentId: `ag_ceo`,
    }) as any
    const cap = createConnectorCapability(db, `p1`, [], { agentId: `ag_ceo` })
    const res = await cap.invoke(`ep_send1`, { body: {} })
    expect(res.ok).toBe(true)
    expect(mocks.applyAuth).toHaveBeenCalledTimes(1) // agent's secret was available to inject
  })
})
