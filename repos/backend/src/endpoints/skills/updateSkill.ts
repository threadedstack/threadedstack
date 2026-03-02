import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

export const updateSkill: TEndpointConfig = {
  path: `/:skillId`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, skillId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!skillId) throw new Exception(400, `skillId is required`)

    await checkPermission(req, EPermAction.update, EPermResource.skill, { orgId })

    // Verify skill exists and belongs to org
    const { data: existing, error: getErr } = await db.services.skill.get(skillId)
    if (getErr || !existing) throw new Exception(404, `Skill not found`)
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
