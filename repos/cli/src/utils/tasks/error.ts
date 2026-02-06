import { Logger } from '@tdsk/logger'
import { isStr } from '@keg-hub/jsutils/isStr'

/**
 * @throws {Error}
 */
export const taskError = (
  err: Error | string,
  stack: boolean = true,
  meta?: Record<string, any>
) => {
  if (isStr(err)) {
    err = new Error(err)
    stack = false
  }
  Logger.header(`Task Error:`)
  stack && err.stack ? Logger.error(`  ${err.stack}`) : Logger.error(`  ${err.message}`)
  meta && console.table(meta)
  Logger.empty()
  process.exit(1)
}
