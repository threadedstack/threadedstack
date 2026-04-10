import { themed } from '@TSA/theme'
import { isStr } from '@keg-hub/jsutils/isStr'

export const taskError = (err: Error | string, stack: boolean = true): never => {
  if (isStr(err)) {
    err = new Error(err)
    stack = false
  }
  const detail = stack && err.stack ? err.stack : err.message
  process.stdout.write(`\n${themed('error', `Task Error:`)} ${detail}\n\n`)
  process.exit(1)
}
