import { describe, test, expect } from 'vitest'
import { get } from '../../utils/api-client'
import { readContext } from '../../utils/test-context'

/**
 * RBAC regression: an API key bound to orgA used against a URL for a
 * different org must NOT be able to read that other org's resources unless
 * the user behind the key is also a member of the URL's org.
 *
 * Pre-RBAC-v2: the `authorize` middleware preferred the `X-User-Org-Id`
 * header over `req.params.orgId`, so a key for orgA hitting
 * `/_/orgs/orgB/secrets` resolved permissions against orgA (where the user
 * was admin) and returned orgB's data. With the URL-first precedence fix,
 * the permission check now runs against the URL's org and rejects via the
 * `getUserRole` membership lookup with 403 "Not a member of this organization".
 */
describe('RBAC: cross-org probe with org-scoped API key', () => {
  const { orgId } = readContext()
  // Real-format-but-nonexistent orgId. Matches the og_ prefix + 7-char suffix
  // shape so validateIdParams accepts it and the request reaches `authorize`,
  // where `getUserRole` returns null and the membership check rejects.
  const fakeOrgId = 'og_FAKEFFE'

  test('GET /_/orgs/<fake>/secrets returns 403 with membership message', async () => {
    const res = await get(`/orgs/${fakeOrgId}/secrets`)
    expect(res.status).toBe(403)
    expect((res.error as any)?.message || (res.error as any)?.error).toMatch(
      /not a member of this organization/i
    )
  })

  test('GET /_/orgs/<fake>/providers returns 403', async () => {
    const res = await get(`/orgs/${fakeOrgId}/providers`)
    expect(res.status).toBe(403)
  })

  test('GET /_/orgs/<malformed>/secrets returns 400 from validateIdParams', async () => {
    // Length > 30 → fails the param shape check before authorize runs.
    const malformed = 'og_FFFFFFE_rbac_cross_org_probe_too_long'
    const res = await get(`/orgs/${malformed}/secrets`)
    expect(res.status).toBe(400)
  })

  // Sanity: same routes against the test user's own org succeed.
  test('GET /_/orgs/<own>/secrets succeeds (sanity)', async () => {
    const res = await get(`/orgs/${orgId}/secrets`)
    expect(res.status).toBe(200)
  })
})
