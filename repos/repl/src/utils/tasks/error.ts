import { themed } from '@TRL/theme'
import { isStr } from '@keg-hub/jsutils/isStr'

export const taskError = (err: Error | string, stack: boolean = true): never => {
  if (isStr(err)) {
    err = new Error(err)
    stack = false
  }
  process.stdout.write(`\n${themed('error', `Task Error:`)} `)
  stack && err.stack
    ? process.stdout.write(`${err.stack}\n`)
    : process.stdout.write(`${err.message}\n`)
  process.stdout.write(`\n`)
  process.exit(1)
}
