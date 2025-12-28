import type { IRouterMatcher } from 'express'

import { isFunc } from '@keg-hub/jsutils/isFunc'
import asyncHandler from 'express-async-handler'
import express, { RequestHandler } from 'express'

export type TBoundMethod = IRouterMatcher<express.Router>

/**
 * Loops the passed in handlers and wraps them in the asyncHandler method
 * Expects the first argument is a string representing the route path
 */
const Async = (Method: TBoundMethod, endpoint: string, ...args: RequestHandler[]) => {
  return Method(endpoint, ...args.filter(isFunc).map((handler) => asyncHandler(handler)))
}

export const createAsyncRouter = () => {
  const Router = express.Router()
  const All = Router.all.bind(Router)
  const Use = Router.use.bind(Router)
  const Get = Router.get.bind(Router)
  const Put = Router.put.bind(Router)
  const Post = Router.post.bind(Router)
  const Patch = Router.patch.bind(Router)
  const Delete = Router.delete.bind(Router)

  Object.assign(Router, {
    all: (endpoint: string, ...args: Array<RequestHandler>) =>
      Async(All, endpoint, ...args),
    use: (endpoint: string, ...args: Array<RequestHandler>) =>
      Async(Use, endpoint, ...args),
    get: (endpoint: string, ...args: Array<RequestHandler>) =>
      Async(Get, endpoint, ...args),
    put: (endpoint: string, ...args: Array<RequestHandler>) =>
      Async(Put, endpoint, ...args),
    post: (endpoint: string, ...args: Array<RequestHandler>) =>
      Async(Post, endpoint, ...args),
    patch: (endpoint: string, ...args: Array<RequestHandler>) =>
      Async(Patch, endpoint, ...args),
    delete: (endpoint: string, ...args: Array<RequestHandler>) =>
      Async(Delete, endpoint, ...args),
  })

  return Router
}

/**
 * Root Express router for the proxy API
 * Extends the express Router, and overrides the main HTTP verb methods
 * It wraps the methods with asyncHandler so it's added by default to those methods
 */
export const router = createAsyncRouter()
