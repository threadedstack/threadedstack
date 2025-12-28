import type {
  Router,
  NextFunction,
  RequestHandler
} from 'express'
import type {
  TRouter,
  TRequest,
  TResponse,
  TAsyncWrap,
  TReqHandler,
  TRouterHandler,
} from '@TDM/types'

import { ApiLogger } from '@tdsk/logger'
import { isObj } from '@keg-hub/jsutils/isObj'
import { toNum } from '@keg-hub/jsutils/toNum'
import { isFunc } from '@keg-hub/jsutils/isFunc'

/**
 * Wraps a request handler in a try/catch
 * If the handler throws, the passed in errorHandler or default handler is called
 * @param {function} handler - Request handler method ( Controller method )
 * @param {function} errHandler - Custom error handler method
 *
 * @returns {function} - Wrapped handler method
 */
export const asyncWrap:TAsyncWrap = (handler:TReqHandler) => (async (
  req:TRequest,
  res:TResponse,
  next:NextFunction
) => {
  try {
    await handler(
      req,
      res,
      next
    )
  }
  catch (err) {

    ApiLogger.error(err)
    if(res.headersSent) return
    res.statusCode = toNum(err.statusCode || 400)
    res.json({message: isObj(err) ? err.message : err || `An api error occurred!`})

  }
})


/**
 * Loops the passed in handlers and wraps them in the asyncWrap method
 * Expects the first argument is a string representing the route path
 */
const wrapInAsync = (
  boundMethod:TRouterHandler,
  middleware:Array<any>,
  ...args:Array<string|RequestHandler>
) => {
  return boundMethod(
    args.shift() as string,
    ...middleware,
    ...(args as RequestHandler[]).filter(isFunc).map((handler) => asyncWrap(handler))
  )
}


export const getAppRouter = (router:Router, md:Array<RequestHandler>=[]) => {

  const boundAll = router.all.bind(router)
  const boundGet = router.get.bind(router)
  const boundPut = router.put.bind(router)
  const boundHead = router.head.bind(router)
  const boundPost = router.post.bind(router)
  const boundPatch = router.patch.bind(router)
  const boundDelete = router.delete.bind(router)
  const boundOptions = router.options.bind(router)

  const AppRouter = Object.assign(router, {
    all: (...args:[string, ...TReqHandler[]]) => wrapInAsync(boundAll, md, ...args),
    get: (...args:[string, ...TReqHandler[]]) => wrapInAsync(boundGet, md, ...args),
    put: (...args:[string, ...TReqHandler[]]) => wrapInAsync(boundPut, md, ...args),
    post: (...args:[string, ...TReqHandler[]]) => wrapInAsync(boundPost, md, ...args),
    head: (...args:[string, ...TReqHandler[]]) => wrapInAsync(boundHead, md, ...args),
    patch: (...args:[string, ...TReqHandler[]]) => wrapInAsync(boundPatch, md, ...args),
    delete: (...args:[string, ...TReqHandler[]]) => wrapInAsync(boundDelete, md, ...args),
    options: (...args:[string, ...TReqHandler[]]) => wrapInAsync(boundOptions, md, ...args),
  }) as unknown as TRouter

  return AppRouter
}

