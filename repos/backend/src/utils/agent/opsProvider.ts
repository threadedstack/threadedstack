import type { IOpsProvider } from '@tdsk/agent'
import type { TDatabase } from '@tdsk/database'
import type { TApp } from '@TBE/types'
import type { EOpsAction } from '@tdsk/domain'

import { createOpsService } from '@TBE/services/ops/ops'
import { proposeOpsAction } from '@TBE/utils/agent/opsPromotion'

/**
 * Create the backend IOpsProvider for the api-brain agent (P4d self-ownership).
 *
 * Wraps createOpsService, threading {orgId, agentId} as ctx to every read call.
 * The WRITE tier (propose) runs the full proposal + dry-run + adversary flow
 * implemented in D6 (opsPromotion.ts).
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

    propose: async (action, params) => {
      return await proposeOpsAction(
        app,
        db,
        orgId,
        agentId,
        action as EOpsAction,
        params,
        { authoredBy: agentId }
      )
    },
  }
}
