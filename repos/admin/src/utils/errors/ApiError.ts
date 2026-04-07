import { Exception } from '@tdsk/domain'
import { toNum } from '@keg-hub/jsutils/toNum'
import { isStr } from '@keg-hub/jsutils/isStr'

export class ApiError extends Exception {
  name = `ApiError`

  constructor(msg: string | Error, status: string | number) {
    const isErr = !isStr(msg)
    const message = isErr ? (msg as Error).message : (msg as string)
    super(toNum(status), message)
    if (isErr) this.stack = (msg as Error).stack
  }
}
