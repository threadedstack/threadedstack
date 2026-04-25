import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { authorize } from '@TBE/middleware/authorize'
import { EPermAction, EPermResource } from '@tdsk/domain'

export const attachSkill: TEndpointConfig = {
  path: `/:skillId/agents/:agentId`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.update, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, skillId, agentId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!skillId) throw new Exception(400, `skillId is required`)
    if (!agentId) throw new Exception(400, `agentId is required`)

    // Verify skill exists and belongs to org
    const { data: skill, error: sErr } = await db.services.skill.get(skillId)
    if (sErr || !skill) throw new Exception(404, `Skill not found`)
    if (skill.orgId !== orgId) throw new Exception(404, `Skill not found`)

    // Verify agent exists and belongs to org
    const { data: agent, error: aErr } = await db.services.agent.get(agentId)
    if (aErr || !agent) throw new Exception(404, `Agent not found`)
    if (agent.orgId !== orgId) throw new Exception(404, `Agent not found`)

    // Insert junction record via skill service
    const { error: attachErr } = await db.services.skill.addAgent(skillId, agentId)
    if (attachErr) throw new Exception(500, `Failed to attach skill`)

    res.status(201).json({ data: { agentId, skillId } })
  },
}
