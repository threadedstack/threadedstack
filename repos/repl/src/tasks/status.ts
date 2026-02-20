import type { TTask } from '@TRL/types'

import { themed } from '@TRL/theme'

export const status: TTask = {
  name: `status`,
  alias: [`st`],
  description: `Show current authentication status`,
  example: `tsa status`,
  action: async ({ auth }) => {
    const creds = auth.getCredentials()
    if (creds) {
      process.stdout.write(
        `\n${themed('bold', `Status:`)} ${themed('primary', `logged in`)}\n`
      )
      process.stdout.write(`  ${themed('muted', `Proxy:`)} ${creds.proxyUrl}\n`)
      process.stdout.write(
        `  ${themed('muted', `Key:`)}   ${creds.apiKey.slice(0, 8)}${'*'.repeat(8)}\n\n`
      )
    } else {
      process.stdout.write(
        `\n${themed('bold', `Status:`)} ${themed('muted', `not logged in`)}\n\n`
      )
    }
  },
}
