import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { authorize } from '@TBE/middleware/authorize'
import { EPermAction, EPermResource } from '@tdsk/domain'

export const detachSkill: TEndpointConfig = {
  path: `/:skillId/agents/:agentId`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.update, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, skillId, agentId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!skillId) throw new Exception(400, `skillId is required`)
    if (!agentId) throw new Exception(400, `agentId is required`)

    // Verify skill exists and belongs to org
    const { data: skill, error: sErr } = await db.services.skill.get(skillId)
    if (sErr) throw new Exception(500, sErr.message)
    if (!skill) throw new Exception(404, `Skill not found`)
    if (skill.orgId !== orgId) throw new Exception(404, `Skill not found`)

    // Verify agent exists and belongs to org
    const { data: agent, error: aErr } = await db.services.agent.get(agentId)
    if (aErr) throw new Exception(500, aErr.message)
    if (!agent) throw new Exception(404, `Agent not found`)
    if (agent.orgId !== orgId) throw new Exception(404, `Agent not found`)

    // Remove junction record via skill service
    const { error: detachErr } = await db.services.skill.removeAgent(skillId, agentId)
    if (detachErr) throw new Exception(500, `Failed to detach skill`)

    res.json({ data: { agentId, skillId } })
  },
}
