import type { TTaskAction } from '@TRL/types'

import { cyan, red } from '@TRL/display/colors'

/**
 * Wraps a task action with an authentication check
 * Exits with code 1 if the user is not logged in
 */
export const requireAuth =
  (action: TTaskAction): TTaskAction =>
  (args) => {
    if (!args.auth.isLoggedIn()) {
      process.stdout.write(
        `${red(`Not logged in.`)} Run ${cyan(`tdsk-agent login <api-key>`)} first.\n`
      )
      process.exit(1)
    }

    return action(args)
  }
