import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

export const getSkill: TEndpointConfig = {
  path: `/:skillId`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, skillId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!skillId) throw new Exception(400, `skillId is required`)

    await checkPermission(req, EPermAction.read, EPermResource.skill, { orgId })

    const { data, error } = await db.services.skill.get(skillId)
    if (error || !data) throw new Exception(404, `Skill not found`)
    if (data.orgId !== orgId) throw new Exception(404, `Skill not found`)

    res.json({ data })
  },
}
