import type { TDatabase } from '@tdsk/database'
import type {
  Endpoint,
  Secret,
  TProxyEndpointConfig,
  TConnectorRequest,
  TConnectorResult,
  IConnectorCapability,
} from '@tdsk/domain'

import { EEndpointType } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { ProxyService } from '@TBE/services/proxy'
import { addEndpointHeaders, guardedFetch } from '@TBE/utils/proxy'
import { SecretResolver } from '@TBE/services/secrets/secretResolver'

/** Max external calls a single Function execution may make (cost/abuse ceiling). */
export const MaxConnectorCallsPerRun = 10

/** Allowed HTTP verbs a connector call may use. */
const AllowedMethods = new Set([`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`])

/** Bridge-callback name exposed to the isolate for the connector capability. */
export const ConnectorBridge = {
  invoke: `connect.invoke`,
} as const

/** A `setHeader`-only shim so ProxyService/addEndpointHeaders populate a plain map. */
type THeaderSink = { setHeader: (name: string, value: string) => void }

const headerSink = (target: Record<string, string>): THeaderSink => ({
  setHeader: (name, value) => {
    target[name.toLowerCase()] = String(value)
  },
})

const decryptAll = async (db: TDatabase, rows: Secret[]): Promise<Secret[]> => {
  if (!rows.length) return []
  const resolver = new SecretResolver(db)
  const out: Secret[] = []
  for (const secret of rows) {
    const value = await resolver.decrypt(secret, secret.orgId || ``)
    out.push(value ? ({ ...secret, value } as Secret) : (secret as Secret))
  }
  return out
}

/** Secrets scoped to the project — for human/platform-configured endpoints. */
const fetchProjectSecrets = async (
  db: TDatabase,
  projectId: string
): Promise<Secret[]> => {
  const { data = [] } = await db.services.secret.list({ where: { projectId } })
  return decryptAll(db, data as Secret[])
}

/**
 * Secrets scoped to a single agent — for that agent's OWN authored endpoints.
 * An agent-authored endpoint is handed ONLY the authoring agent's secrets, never
 * the project set, so it cannot template a project/human secret into a header or
 * oauth field and exfiltrate it to an agent-chosen host (the resolver templates
 * far more fields than any author-time check enumerates — scoping the input set
 * closes that whole class of bug regardless of which field is missed).
 */
const fetchAgentSecrets = async (db: TDatabase, agentId: string): Promise<Secret[]> => {
  const { data = [] } = await db.services.secret.list({ where: { agentId } })
  return decryptAll(db, data as Secret[])
}

/** Resolve an endpoint by id or name, scoped to the project (never cross-project). */
const resolveProjectEndpoint = async (
  db: TDatabase,
  projectId: string,
  ref: string
): Promise<Endpoint | null> => {
  // by id first
  const byId = await db.services.endpoint.get(ref)
  if (byId.data && byId.data.projectId === projectId) return byId.data as Endpoint
  // then by name within the project
  const byName = await db.services.endpoint.list({ where: { projectId, name: ref } })
  return (byName.data?.[0] as Endpoint) ?? null
}

const parseResponseBody = async (res: Response): Promise<unknown> => {
  const text = await res.text()
  if (!text) return null
  const contentType = res.headers.get(`content-type`) ?? ``
  if (contentType.includes(`application/json`)) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

/**
 * Build the project-scoped external-connection capability. Every call:
 *  - is charged against a per-run budget (MaxConnectorCallsPerRun);
 *  - resolves the endpoint within THIS project only;
 *  - requires the endpoint ref to be on the caller's `allowedRefs` allowlist
 *    (authorship of a Function does NOT confer access to every project endpoint);
 *  - accepts ONLY `proxy` endpoints, and REFUSES any with transform.injectSecrets
 *    (that path templates real secrets into the response body — never hand one to
 *    the isolate);
 *  - injects auth/secrets host-side via ProxyService (secrets never cross in);
 *  - calls the upstream through `guardedFetch` (SSRF egress guard + guarded
 *    redirects) with the endpoint's fixed host and no caller-supplied path.
 * All failures return `{ ok: false, error }` — never throw into the isolate, and
 * error strings never include secret values.
 */
export const createConnectorCapability = (
  db: TDatabase,
  projectId: string,
  allowedRefs: string[],
  caller?: { agentId?: string }
): IConnectorCapability => {
  let callsRemaining = MaxConnectorCallsPerRun
  const proxyService = new ProxyService()
  const allow = new Set(allowedRefs)

  return {
    invoke: async (
      ref: string,
      request: TConnectorRequest = {}
    ): Promise<TConnectorResult> => {
      try {
        if (callsRemaining <= 0)
          return { ok: false, error: `connector call budget exhausted` }
        callsRemaining -= 1

        const endpoint = await resolveProjectEndpoint(db, projectId, ref)
        if (!endpoint) return { ok: false, error: `endpoint not found: ${ref}` }

        // AUTHORSHIP IS AUTHORIZATION (mirrors invokeAction): an agent may reach
        // an endpoint IT authored with no allowlist entry — this is what lets an
        // agent build and use its OWN connector with zero human config. The
        // git-seeded `connectEndpoints` allowlist remains only as an optional
        // extra grant (e.g. to share a connector across seats).
        const authored =
          Boolean(caller?.agentId) && endpoint.meta?.authoredBy === caller?.agentId
        if (!authored && !allow.has(endpoint.id) && !allow.has(endpoint.name))
          return { ok: false, error: `endpoint not permitted for this function: ${ref}` }

        if (endpoint.type !== EEndpointType.proxy)
          return { ok: false, error: `connect supports only proxy endpoints` }

        const opts = endpoint.options as TProxyEndpointConfig
        if (!opts?.url) return { ok: false, error: `endpoint has no url` }
        if (opts.transform?.injectSecrets)
          return {
            ok: false,
            error: `endpoint injects secrets into responses; not reachable via connect`,
          }

        const method = (
          request.method ??
          opts.proxyMethod ??
          endpoint.method ??
          `POST`
        ).toUpperCase()
        if (!AllowedMethods.has(method))
          return { ok: false, error: `method not allowed: ${method}` }

        // Scope the decrypted secret set to WHY this call is authorized: an
        // agent-AUTHORED endpoint sees ONLY the authoring agent's own secrets
        // (never the project set — closes cross-owner secret exfiltration via
        // templated header/oauth fields); an ALLOWLISTED (human-configured)
        // endpoint sees the project secrets it was set up with.
        const secrets =
          authored && caller?.agentId
            ? await fetchAgentSecrets(db, caller.agentId)
            : await fetchProjectSecrets(db, projectId)

        // Build headers: endpoint static headers + caller headers, then auth
        // injection wins (secret-bearing headers overwrite anything the caller set).
        const headers: Record<string, string> = {}
        for (const [k, v] of Object.entries(request.headers ?? {}))
          headers[k.toLowerCase()] = String(v)
        const sink = headerSink(headers)
        if (endpoint.headers) addEndpointHeaders(sink as never, endpoint.headers, secrets)
        if (opts.auth) await proxyService.applyAuth(sink as never, opts.auth, secrets)
        if (opts.oauth) await proxyService.applyOAuth(sink as never, opts.oauth, secrets)

        // Fixed host from the endpoint; caller may only vary the query (no path).
        const url = new URL(opts.url)
        for (const [k, v] of Object.entries(request.query ?? {}))
          url.searchParams.set(k, String(v))

        const hasBody =
          request.body !== undefined && method !== `GET` && method !== `HEAD`
        if (hasBody && !headers[`content-type`])
          headers[`content-type`] = `application/json`

        const res = await guardedFetch(url.toString(), {
          method,
          headers,
          body: hasBody ? JSON.stringify(request.body) : undefined,
        })

        return { ok: res.ok, status: res.status, body: await parseResponseBody(res) }
      } catch (err) {
        // Never surface a secret; return a generic transport error.
        logger.error(`[connector] invoke failed for ${ref}:`, (err as Error)?.message)
        return { ok: false, error: `connector call failed` }
      }
    },
  }
}

/**
 * Wrap the connector capability as a JSON-marshalling host bridge. Only the JSON
 * request and JSON result cross the isolate boundary — never the db, secrets, or
 * the live capability object. Built whenever there is an explicit endpoint grant
 * OR a calling agent (so the agent can reach endpoints IT authored via
 * authorship=authorization); returns an empty map (connect unavailable) only when
 * there is neither — connect stays fail-closed for un-identified callers.
 */
export const buildConnectorBridges = (
  db: TDatabase,
  projectId: string,
  allowedRefs: string[],
  caller?: { agentId?: string }
): Record<string, (argsJson: string) => Promise<string>> => {
  if (!allowedRefs.length && !caller?.agentId) return {}
  const connector = createConnectorCapability(db, projectId, allowedRefs, caller)
  return {
    [ConnectorBridge.invoke]: async (argsJson) => {
      const [ref, req] = JSON.parse(argsJson) as [string, TConnectorRequest?]
      return JSON.stringify(await connector.invoke(ref, req ?? {}))
    },
  }
}

/**
 * Reconstruct `context.connect` inside the isolate from the `__hostCall` bridge —
 * same marshalling shape as `context.records`. Only emitted when the connector
 * bridge is present (i.e. the caller granted at least one endpoint).
 */
export const connectContextCode = `context.connect = (() => {
  const call = (name, args) => __hostCall(name, JSON.stringify(args)).then((r) => JSON.parse(r));
  return {
    invoke: (ref, request) => call('${ConnectorBridge.invoke}', [ref, request]),
  };
})();`
