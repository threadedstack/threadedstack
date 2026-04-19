import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { authorize } from '@TBE/middleware/authorize'
import { EPermAction, EPermResource } from '@tdsk/domain'

export const getSkill: TEndpointConfig = {
  path: `/:skillId`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.skill)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, skillId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!skillId) throw new Exception(400, `skillId is required`)

    const { data, error } = await db.services.skill.get(skillId)
    if (error || !data) throw new Exception(404, `Skill not found`)
    if (data.orgId !== orgId) throw new Exception(404, `Skill not found`)

    res.json({ data })
  },
}
