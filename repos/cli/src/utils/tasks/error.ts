import { Logger } from '@tdsk/logger'
import { isStr } from '@keg-hub/jsutils/isStr'

export const taskError = (err: Error | string, stack: boolean = true) => {
  if (isStr(err)) {
    err = new Error(err)
    stack = false
  }
  Logger.header(`Task Error:`)
  stack && err.stack ? Logger.error(`  ${err.stack}`) : Logger.error(`  ${err.message}`)
  Logger.empty()
  process.exit(1)
}
