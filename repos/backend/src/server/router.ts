import type { IRouterMatcher, RequestHandler } from 'express'

import type { TRouter } from '@tdsk/domain'

import express from 'express'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import asyncHandler from 'express-async-handler'

export type TBoundMethod = IRouterMatcher<express.Router>

/**
 * Loops the passed in handlers and wraps them in the asyncHandler method
 * Expects the first argument is a string representing the route path
 */
const Async = (Method: TBoundMethod, endpoint: string, ...args: RequestHandler[]) => {
  return Method(endpoint, ...args.filter(isFunc).map((handler) => asyncHandler(handler)))
}

const asyncMethods = [`all`, `use`, `get`, `put`, `post`, `patch`, `delete`] as const

export const createAsyncRouter = () => {
  const Router = express.Router({ mergeParams: true })

  for (const method of asyncMethods) {
    const bound = Router[method].bind(Router) as TBoundMethod
    ;(Router as unknown as Record<string, unknown>)[method] = (
      endpoint: string,
      ...args: RequestHandler[]
    ) => Async(bound, endpoint, ...args)
  }

  return Router as unknown as TRouter
}

/**
 * Root Express router for the backend API
 * Extends the express Router, and overrides the main HTTP verb methods
 * It wraps the methods with asyncHandler so it's added by default to those methods
 */
export const router = createAsyncRouter()
