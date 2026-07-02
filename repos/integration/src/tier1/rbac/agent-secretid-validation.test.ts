import { describe, test, expect } from 'vitest'
import { post } from '../../utils/api-client'
import { readContext } from '../../utils/test-context'
import { isFeatureEnabled } from '@tdsk/domain'
import { uniqueName } from '../../utils/unique-name'

/**
 * RBAC regression: `createAgent` previously accepted any `secretIds[]` value
 * and wrote it to the agent record without validating ownership. The fix
 * fetches each secret and rejects the request if it doesn't exist or doesn't
 * belong to the same org.
 *
 * This test exercises the not-found branch. The cross-org branch is covered
 * by the unit test in `repos/backend/src/endpoints/agents/agents.test.ts`.
 */
describe.skipIf(!isFeatureEnabled('agents'))(
  'RBAC: createAgent secretId validation',
  () => {
    const { orgId } = readContext()

    test('rejects unknown secretId with 400 Secret not found', async () => {
      const res = await post(`/orgs/${orgId}/agents`, {
        name: uniqueName('rbac-secret-validation'),
        orgId,
        // providerInputs must reference an existing org AI provider by id;
        // brand/model-only inputs are filtered out by provider.validate().
        // Uses the seeded anthropic provider so validation reaches secretIds.
        providerInputs: [{ id: 'pv_0000002' }],
        secretIds: ['sec_DOESNOTEXIST_rbac_test'],
      })

      expect(res.status).toBe(400)
      expect((res.error as any)?.message || (res.error as any)?.error).toMatch(
        /Secret sec_DOESNOTEXIST_rbac_test not found/
      )
    })
  }
)
