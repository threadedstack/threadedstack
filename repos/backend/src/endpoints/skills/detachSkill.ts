import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

export const detachSkill: TEndpointConfig = {
  path: `/:skillId/agents/:agentId`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, skillId, agentId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!skillId) throw new Exception(400, `skillId is required`)
    if (!agentId) throw new Exception(400, `agentId is required`)

    await checkPermission(req, EPermAction.update, EPermResource.agent, { orgId })

    // Verify skill exists and belongs to org
    const { data: skill, error: sErr } = await db.services.skill.get(skillId)
    if (sErr || !skill) throw new Exception(404, `Skill not found`)
    if (skill.orgId !== orgId) throw new Exception(404, `Skill not found`)

    // Verify agent exists and belongs to org
    const { data: agent, error: aErr } = await db.services.agent.get(agentId)
    if (aErr || !agent) throw new Exception(404, `Agent not found`)
    if (agent.orgId !== orgId) throw new Exception(404, `Agent not found`)

    // Remove junction record via skill service
    const { error: detachErr } = await db.services.skill.removeAgent(skillId, agentId)
    if (detachErr) throw new Exception(500, `Failed to detach skill`)

    res.json({ data: { agentId, skillId } })
  },
}
