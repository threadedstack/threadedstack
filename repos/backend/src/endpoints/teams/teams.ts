import type { TEndpointConfig } from '@TBE/types'
import type { Request, Response } from 'express'

import { EPMethod } from '@TBE/types'

/**
 * GET /teams - List all teams
 */
const listTeams: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: Request, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { data, error } = await db.services.team.list()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}

/**
 * GET /teams/:id - Get team by ID
 */
const getTeam: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { data, error } = await db.services.team.get(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    if (!data) {
      res.status(404).json({ error: `Team not found` })
      return
    }

    res.status(200).json({ data })
  },
}

/**
 * POST /teams - Create a new team
 */
const createTeam: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: Request, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const teamData = req.body

    if (!teamData || !teamData.name) {
      res.status(400).json({ error: `Team name is required` })
      return
    }

    const { data, error } = await db.services.team.create(teamData)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ data })
  },
}

/**
 * PUT /teams/:id - Update an existing team
 */
const updateTeam: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const teamData = req.body

    // Check if team exists first
    const { data: existingTeam, error: getError } = await db.services.team.get(id)

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existingTeam) {
      res.status(404).json({ error: `Team not found` })
      return
    }

    const { data, error } = await db.services.team.update({ ...teamData, id })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}

/**
 * DELETE /teams/:id - Delete a team
 */
const deleteTeam: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    // Check if team exists first
    const { data: existingTeam, error: getError } = await db.services.team.get(id)

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existingTeam) {
      res.status(404).json({ error: `Team not found` })
      return
    }

    const { data, error } = await db.services.team.delete(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}

/**
 * POST /teams/:id/members - Add a member to a team
 * Creates a role entry linking the user to the team
 */
const addTeamMember: TEndpointConfig = {
  path: `/:id/members`,
  method: EPMethod.Post,
  action: async (req: Request, res: Response): Promise<void> => {
    const { id: teamId } = req.params
    const { db } = req.app.locals
    const { userId, type = `basic` } = req.body

    if (!userId) {
      res.status(400).json({ error: `userId is required` })
      return
    }

    // Check if team exists
    const { data: existingTeam, error: teamError } = await db.services.team.get(teamId)

    if (teamError) {
      res.status(500).json({ error: teamError.message })
      return
    }

    if (!existingTeam) {
      res.status(404).json({ error: `Team not found` })
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

    // Create role (team membership)
    const { data, error } = await db.services.role.create({
      teamId,
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
 * DELETE /teams/:id/members/:userId - Remove a member from a team
 * Deletes the role entry linking the user to the team
 */
const removeTeamMember: TEndpointConfig = {
  path: `/:id/members/:userId`,
  method: EPMethod.Delete,
  action: async (req: Request, res: Response): Promise<void> => {
    const { id: teamId, userId } = req.params
    const { db } = req.app.locals

    // Check if team exists
    const { data: existingTeam, error: teamError } = await db.services.team.get(teamId)

    if (teamError) {
      res.status(500).json({ error: teamError.message })
      return
    }

    if (!existingTeam) {
      res.status(404).json({ error: `Team not found` })
      return
    }

    // Find the role entry for this team/user combination
    // Since the base service doesn't have a findByTeamAndUser method,
    // we'll need to list roles and filter, or the role service could be extended
    // For now, we'll use a workaround by listing and finding
    const { data: roles, error: listError } = await db.services.role.list()

    if (listError) {
      res.status(500).json({ error: listError.message })
      return
    }

    const memberRole = roles?.find(
      (role: { teamId: string; userId: string }) =>
        role.teamId === teamId && role.userId === userId
    )

    if (!memberRole) {
      res.status(404).json({ error: `Team member not found` })
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

export const teams: TEndpointConfig = {
  path: `/teams`,
  method: EPMethod.Use,
  endpoints: {
    listTeams,
    getTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    addTeamMember,
    removeTeamMember,
  },
}
