import { isObj } from '@keg-hub/jsutils/isObj'

type TCustomErr = {
  code?: string
  stack?: string
  message: string
}

export type TExceptionOpts = Error | TCustomErr

export class Exception extends Error {
  static throw = (status: number, message: string | TExceptionOpts, code?: string) => {
    throw new Exception(status, message, code)
  }

  code?: string
  status: number
  message: string

  constructor(status: number, message: string | TExceptionOpts, code?: string) {
    const err = isObj(message) ? message : { message, code }

    super(err.message)
    this.status = status
    this.code = (err as TCustomErr).code || code
  }
}
