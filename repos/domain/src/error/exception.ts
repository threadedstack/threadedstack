import { ensureArr } from '@keg-hub/jsutils/ensureArr'

export type TErrDetail = {
  loc: string[]
  msg: string
  type: string
}

export type TErrDetails = Array<TErrDetail | string> | string | TErrDetail

export class Exception extends Error {
  name: string = `Exception`

  static throw = (
    status: number,
    message: string,
    code?: string,
    details?: TErrDetails,
    stack?: string
  ) => {
    throw new Exception(status, message, code, details, stack)
  }

  stack: string
  status: number
  message: string
  code?: string
  details?: TErrDetails
  __isAuthError?: boolean = false

  constructor(
    status: number,
    message: string | Error,
    code?: string,
    details?: TErrDetails,
    stack?: string
  ) {
    if (message instanceof Error) {
      const err = message as Error
      message = err.message
      if (err.stack && !stack) stack = err.stack
      if (err.cause && !details) details = err.cause as string
    }

    super(message)
    this.status = status
    this.message = message

    if (code) this.code = code
    if (stack) this.stack = stack
    if (details) this.details = ensureArr(details)
  }
}
