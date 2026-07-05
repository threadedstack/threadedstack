import type { IOpsProvider } from '@tdsk/agent'
import type { TDatabase } from '@tdsk/database'
import type { TApp } from '@TBE/types'

import { createOpsService } from '@TBE/services/ops/ops'

/**
 * Create the backend IOpsProvider for the api-brain agent (P4d self-ownership).
 *
 * Wraps createOpsService, threading {orgId, agentId} as ctx to every read call.
 * The WRITE tier (propose) is explicitly stubbed — D6 replaces it with the full
 * proposal + dry-run + adversary flow. Callers that try write actions in D5 will
 * get a loud error rather than silent no-ops.
 */
export const createOpsProvider = (
  app: TApp,
  db: TDatabase,
  orgId: string,
  agentId: string
): IOpsProvider => {
  const svc = createOpsService(app, db)
  const ctx = { orgId, agentId }

  return {
    podStatus: (params) => svc.podStatus(params, ctx),
    podLogs: (params) => svc.podLogs(params, ctx),
    deployState: (params) => svc.deployState(params, ctx),
    quotaUsage: (params) => svc.quotaUsage(params as Record<string, never>, ctx),

    propose: async (action) => {
      throw new Error(
        `[P4d D5] Ops write proposal not yet wired — implemented in D6. Attempted action: ${action}`
      )
    },
  }
}
