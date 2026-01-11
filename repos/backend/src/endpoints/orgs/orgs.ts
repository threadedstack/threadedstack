import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import type { Role } from '@tdsk/domain'
import { EPMethod } from '@TBE/types'

/**
 * GET /orgs - List all orgs
 */
const listOrgs: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { data, error } = await db.services.org.list()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}

/**
 * GET /orgs/:id - Get org by ID
 */
const getOrg: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { data, error } = await db.services.org.get(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    if (!data) {
      res.status(404).json({ error: `Org not found` })
      return
    }

    res.status(200).json({ data })
  },
}

/**
 * POST /orgs - Create a new org
 */
const createOrg: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const orgData = req.body

    if (!orgData || !orgData.name) {
      res.status(400).json({ error: `Org name is required` })
      return
    }

    const { data, error } = await db.services.org.create(orgData)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ data })
  },
}

/**
 * PUT /orgs/:id - Update an existing org
 */
const updateOrg: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const orgData = req.body

    // Check if org exists first
    const { data: existingOrg, error: getError } = await db.services.org.get(id)

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existingOrg) {
      res.status(404).json({ error: `Org not found` })
      return
    }

    const { data, error } = await db.services.org.update({ ...orgData, id })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}

/**
 * DELETE /orgs/:id - Delete a org
 */
const deleteOrg: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    // Check if org exists first
    const { data: existingOrg, error: getError } = await db.services.org.get(id)

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existingOrg) {
      res.status(404).json({ error: `Org not found` })
      return
    }

    const { data, error } = await db.services.org.delete(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}

/**
 * POST /orgs/:id/members - Add a member to a org
 * Creates a role entry linking the user to the org
 */
const addOrgMember: TEndpointConfig = {
  path: `/:id/members`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id: orgId } = req.params
    const { db } = req.app.locals
    const { userId, type = `basic` } = req.body

    if (!userId) {
      res.status(400).json({ error: `userId is required` })
      return
    }

    // Check if org exists
    const { data: existingOrg, error: orgError } = await db.services.org.get(orgId)

    if (orgError) {
      res.status(500).json({ error: orgError.message })
      return
    }

    if (!existingOrg) {
      res.status(404).json({ error: `Org not found` })
      return
    }

    // Check if user exists
    const { data: existingUser, error: userError } = await db.services.user.get(userId)

    if (userError) {
      res.status(500).json({ error: userError.message })
      return
    }

    if (!existingUser) {
      res.status(404).json({ error: `User not found` })
      return
    }

    // Create role (org membership)
    const { data, error } = await db.services.role.create({
      orgId,
      userId,
      type,
    })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ data })
  },
}

/**
 * DELETE /orgs/:id/members/:userId - Remove a member from a org
 * Deletes the role entry linking the user to the org
 */
const removeOrgMember: TEndpointConfig = {
  path: `/:id/members/:userId`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id: orgId, userId } = req.params
    const { db } = req.app.locals

    // Check if org exists
    const { data: existingOrg, error: orgError } = await db.services.org.get(orgId)

    if (orgError) {
      res.status(500).json({ error: orgError.message })
      return
    }

    if (!existingOrg) {
      res.status(404).json({ error: `Org not found` })
      return
    }

    // Find the role entry for this org/user combination
    // Since the base service doesn't have a findByOrgAndUser method,
    // we'll need to list roles and filter, or the role service could be extended
    // For now, we'll use a workaround by listing and finding
    const { data: roles, error: listError } = await db.services.role.list()

    if (listError) {
      res.status(500).json({ error: listError.message })
      return
    }

    const memberRole = roles?.find((role: Role) => {
      return role.orgId === orgId && role.userId === userId
    })

    if (!memberRole) {
      res.status(404).json({ error: `Org member not found` })
      return
    }

    const { data, error } = await db.services.role.delete(memberRole.id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}

export const orgs: TEndpointConfig = {
  path: `/orgs`,
  method: EPMethod.Use,
  endpoints: {
    listOrgs,
    getOrg,
    createOrg,
    updateOrg,
    deleteOrg,
    addOrgMember,
    removeOrgMember,
  },
}
