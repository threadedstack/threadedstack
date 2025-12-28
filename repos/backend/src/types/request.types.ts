import type { Request, Response } from 'express'
import type { TTokenMintOpts } from './token.types'

export type TErrorResponse = {
  code?: number
  error?: string
}

export interface RequestBody<T> extends Request {
  body: T
}

export interface RequestQuery<T> extends Request<{}, {}, {}, T> {}

export interface ResponseBody<T> extends Response<T | TErrorResponse> {}

export type TAuthRequest = RequestQuery<{ token: string }>

type TTokenReqBody = {
  clientId: string
  clientSecret: string
  claims: TTokenMintOpts
  grantType: `client_credentials`
}

type TTokenResBody = {
  token: string
}

export type TTokenRequest = RequestBody<TTokenReqBody>
export type TTokenResponse = ResponseBody<TTokenResBody>
