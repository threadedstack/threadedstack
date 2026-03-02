import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Skill } from '@tdsk/domain'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

export const createSkill: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)

    await checkPermission(req, EPermAction.create, EPermResource.skill, { orgId })

    const { name, description, instructions, triggerKeywords, tools, alwaysActive } =
      req.body
    if (!name) throw new Exception(400, `name is required`)
    if (!instructions) throw new Exception(400, `instructions is required`)

    const skill = new Skill({
      name,
      orgId,
      description: description || ``,
      instructions,
      triggerKeywords: triggerKeywords || [],
      tools: tools || [],
      alwaysActive: alwaysActive || false,
    })

    const { data, error } = await db.services.skill.create(skill)
    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
