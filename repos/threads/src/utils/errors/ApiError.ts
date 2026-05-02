import { toNum } from '@keg-hub/jsutils/toNum'
import { isStr } from '@keg-hub/jsutils/isStr'

export class ApiError extends Error {
  status: number
  name = `ApiError`
  details?: Record<string, any>

  constructor(
    msg: string | Error,
    status: string | number,
    details?: Record<string, any>
  ) {
    const isErr = !isStr(msg)
    const message = isErr ? msg.message : msg
    super(message)

    this.status = toNum(status)
    if (isErr) this.stack = msg.stack
    if (details) this.details = details
  }
}
