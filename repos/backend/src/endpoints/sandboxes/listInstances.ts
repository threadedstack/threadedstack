import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { PodLabelKeys } from '@tdsk/sandbox'
import { authorize } from '@TBE/middleware/authorize'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import {
  Exception,
  EPermAction,
  EPermResource,
  EContainerState,
  DefaultMaxInstances,
} from '@tdsk/domain'

export const listInstances: TEndpointConfig = {
  path: `/:id/instances`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const sandbox = await resolveSandbox(db.services.sandbox, id, req.params.projectId)

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    const activePods = await sb.findActivePods(sandbox.id, sandbox.orgId)
    const allPods = await sb.listPods({ orgId: sandbox.orgId })
    const podsByName = new Map(allPods.map((p: any) => [p.metadata?.name, p]))

    const instances = await Promise.all(
      activePods.map(async (podName: string) => {
        let state: EContainerState
        try {
          state = await sb.getPodState(podName)
        } catch {
          state = EContainerState.Unknown
        }
        const sessions = sb.getSessions(podName)
        const pod = podsByName.get(podName)
        const userId = pod?.metadata?.labels?.[PodLabelKeys.userId] ?? ``

        return {
          state,
          userId,
          podName,
          sandboxId: sandbox.id,
          sessionCount: sessions.length,
          sessions: sessions.map((s: any) => ({
            ...s,
            hasShellSession: !!sb.getShellSession(s.sessionId),
          })),
        }
      })
    )

    const maxInstances = sandbox.config.maxInstances ?? DefaultMaxInstances

    res.status(200).json({ data: { instances, maxInstances } })
  },
}
