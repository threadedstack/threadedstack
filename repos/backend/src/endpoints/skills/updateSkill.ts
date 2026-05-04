import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { authorize } from '@TBE/middleware/authorize'
import { EPermAction, EPermResource } from '@tdsk/domain'

export const updateSkill: TEndpointConfig = {
  path: `/:skillId`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.skill)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, skillId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!skillId) throw new Exception(400, `skillId is required`)

    // Verify skill exists and belongs to org
    const { data: existing, error: getErr } = await db.services.skill.get(skillId)
    if (getErr) throw new Exception(500, getErr.message)
    if (!existing) throw new Exception(404, `Skill not found`)
    if (existing.orgId !== orgId) throw new Exception(404, `Skill not found`)

    const { name, description, instructions, triggerKeywords, tools, alwaysActive } =
      req.body

    const { data, error } = await db.services.skill.update({
      id: skillId,
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(instructions !== undefined && { instructions }),
      ...(triggerKeywords !== undefined && { triggerKeywords }),
      ...(tools !== undefined && { tools }),
      ...(alwaysActive !== undefined && { alwaysActive }),
    })

    if (error) throw new Exception(500, error.message)

    res.json({ data })
  },
}
