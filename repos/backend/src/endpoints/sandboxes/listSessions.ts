import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const listSessions: TEndpointConfig = {
  path: `/:id/sessions`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const sandbox = await resolveSandbox(db.services.sandbox, id, req.params.projectId)

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    const runningPods = await sb.findRunningPods(sandbox.id, sandbox.orgId)
    const sessions = runningPods.flatMap((podName: string) => sb.getSessions(podName))

    const enriched = sessions.map((s) => ({
      ...s,
      hasShellSession: !!sb.getShellSession(s.sessionId),
    }))

    res.status(200).json({ data: enriched })
  },
}
