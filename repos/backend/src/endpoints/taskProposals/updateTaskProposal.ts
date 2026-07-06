import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import {
  Exception,
  EPermAction,
  EPermResource,
  ETaskPriority,
  ETaskProposalStatus,
} from '@tdsk/domain'

const ValidPriorities = new Set<string>(Object.values(ETaskPriority))
const ValidStatuses = new Set<string>(Object.values(ETaskProposalStatus))

/**
 * PUT /:orgId/task-proposals/:proposalId - Update a task proposal (org-scoped).
 * Only provided fields change; priority and status are validated against their
 * enums. A missing or cross-org proposal 404s.
 */
export const updateTaskProposal: TEndpointConfig = {
  path: `/:proposalId`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.taskProposal)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, proposalId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!proposalId) throw new Exception(400, `proposalId is required`)

    const { data: existing, error: getErr } =
      await db.services.taskProposal.get(proposalId)
    if (getErr) throw new Exception(500, getErr.message)
    if (!existing || existing.orgId !== orgId)
      throw new Exception(404, `Task proposal not found`)

    const { title, description, priority, evidence, repos, initiative, reason, status } =
      req.body

    const update: Record<string, any> = { id: proposalId }

    if (title !== undefined) {
      if (typeof title !== `string` || title.trim().length === 0)
        throw new Exception(400, `title must be a non-empty string`)
      update.title = title.trim()
    }
    if (description !== undefined) {
      if (typeof description !== `string` || description.trim().length === 0)
        throw new Exception(400, `description must be a non-empty string`)
      update.description = description.trim()
    }
    if (evidence !== undefined) {
      if (typeof evidence !== `string` || evidence.trim().length === 0)
        throw new Exception(400, `evidence must be a non-empty string`)
      update.evidence = evidence.trim()
    }
    if (priority !== undefined) {
      if (!ValidPriorities.has(priority))
        throw new Exception(400, `Invalid priority: ${priority}`)
      update.priority = priority
    }
    if (status !== undefined) {
      if (!ValidStatuses.has(status))
        throw new Exception(400, `Invalid status: ${status}`)
      update.status = status
    }
    if (repos !== undefined) {
      if (!Array.isArray(repos) || !repos.every((r) => typeof r === `string`))
        throw new Exception(400, `repos must be an array of strings`)
      update.repos = repos
    }
    if (initiative !== undefined) {
      if (initiative !== null && typeof initiative !== `string`)
        throw new Exception(400, `initiative must be a string`)
      update.initiative = initiative
    }
    if (reason !== undefined) {
      if (reason !== null && typeof reason !== `string`)
        throw new Exception(400, `reason must be a string`)
      update.reason = reason
    }

    const { data, error } = await db.services.taskProposal.update(update as any)
    if (error) throw new Exception(500, error.message)

    res.json({ data })
  },
}
