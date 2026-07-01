import { describe, test, expect } from 'vitest'
import { get } from '../../utils/api-client'
import { readContext } from '../../utils/test-context'
import { isFeatureEnabled } from '@tdsk/domain'

/**
 * RBAC regression: `listAgents` previously accepted `?projectId=` in the query
 * and let it shadow the URL's project scope. The fix rejects the request when
 * the query param disagrees with the URL with 400 `SCOPE_MISMATCH`.
 *
 * Gated on the `agents` feature flag because the route is otherwise 404 from
 * `featureGate`, which would mask the SCOPE_MISMATCH signal.
 *
 * The URL uses the REAL test project (the caller is a member) so `authorize`
 * passes on membership and the request reaches `listAgents`, where the
 * query/URL mismatch is what produces the 400 — otherwise the 400 could come
 * from `authorize` (non-member) or `validateIdParams` (bad id shape) and the
 * test would not actually prove the scope-mismatch guard runs.
 */
describe.skipIf(!isFeatureEnabled('agents'))(
  'RBAC: query/URL scope mismatch',
  () => {
    const { orgId, projectId } = readContext()

    test.skipIf(!projectId)(
      'GET /_/orgs/:orgId/projects/:real/agents?projectId=<other> returns 400 SCOPE_MISMATCH',
      async () => {
        const res = await get(
          `/orgs/${orgId}/projects/${projectId}/agents?projectId=pj_OTHERSCOPE`
        )
        expect(res.status).toBe(400)
        // The 400 must be attributable to the scope-mismatch guard, not to
        // authorize (membership) or validateIdParams (id shape).
        const detail = JSON.stringify(res.error ?? '')
        expect(detail).toMatch(/SCOPE_MISMATCH|does not match URL scope/i)
      }
    )

    test.skipIf(!projectId)(
      'GET /_/orgs/:orgId/projects/:real/agents?projectId=<same> succeeds (sanity)',
      async () => {
        const res = await get(
          `/orgs/${orgId}/projects/${projectId}/agents?projectId=${projectId}`
        )
        expect(res.status).toBe(200)
      }
    )
  }
)
