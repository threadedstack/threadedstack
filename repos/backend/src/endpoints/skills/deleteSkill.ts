import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

export const deleteSkill: TEndpointConfig = {
  path: `/:skillId`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, skillId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!skillId) throw new Exception(400, `skillId is required`)

    await checkPermission(req, EPermAction.delete, EPermResource.skill, { orgId })

    // Verify skill exists and belongs to org
    const { data: existing, error: getErr } = await db.services.skill.get(skillId)
    if (getErr || !existing) throw new Exception(404, `Skill not found`)
    if (existing.orgId !== orgId) throw new Exception(404, `Skill not found`)

    const { error } = await db.services.skill.delete(skillId)
    if (error) throw new Exception(500, error.message)

    res.json({ data: { id: skillId } })
  },
}
