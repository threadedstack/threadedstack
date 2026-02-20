import type { TTask } from '@TRL/types'

import { themed } from '@TRL/theme'

export const logout: TTask = {
  name: `logout`,
  alias: [`lo`],
  description: `Remove stored credentials`,
  example: `tsa logout`,
  action: async ({ auth }) => {
    auth.logout()
    process.stdout.write(`${themed('success', `Logged out`)}\n`)
  },
}
