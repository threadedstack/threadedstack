import type { TEndpointConfig } from '@TBE/types'
import type { Request, Response } from 'express'

import { EPMethod } from '@TBE/types'

/**
 * GET /users - List all users
 */
const listUsers: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: Request, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { data, error } = await db.services.user.list()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}

/**
 * GET /users/:id - Get user by ID
 */
const getUser: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { data, error } = await db.services.user.get(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    if (!data) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.status(200).json({ data })
  },
}

/**
 * POST /users - Create a new user
 */
const createUser: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: Request, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userData = req.body

    if (!userData || !userData.email) {
      res.status(400).json({ error: 'Email is required' })
      return
    }

    const { data, error } = await db.services.user.create(userData)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ data })
  },
}

/**
 * PUT /users/:id - Update an existing user
 */
const updateUser: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const userData = req.body

    // Check if user exists first
    const { data: existingUser, error: getError } = await db.services.user.get(id)

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existingUser) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const { data, error } = await db.services.user.update({ ...userData, id })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}

/**
 * DELETE /users/:id - Delete a user
 */
const deleteUser: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    // Check if user exists first
    const { data: existingUser, error: getError } = await db.services.user.get(id)

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existingUser) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const { data, error } = await db.services.user.delete(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}

export const users: TEndpointConfig = {
  path: `/users`,
  method: EPMethod.Use,
  endpoints: {
    listUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
  },
}
