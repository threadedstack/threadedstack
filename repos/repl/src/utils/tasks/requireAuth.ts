import type { TTaskAction } from '@TRL/types'

import { themed } from '@TRL/theme'

/**
 * Wraps a task action with an authentication check
 * Exits with code 1 if the user is not logged in
 */
export const requireAuth =
  (action: TTaskAction): TTaskAction =>
  (args) => {
    if (!args.auth.loggedIn()) {
      process.stdout.write(
        `${themed('error', `Not logged in.`)} Run ${themed('primary', `tsa login <api-key>`)} first.\n`
      )
      process.exit(1)
    }

    return action(args)
  }
