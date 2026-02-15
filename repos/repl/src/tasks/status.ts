import type { TTask } from '@TRL/types'

import { bold, cyan, dim } from '@TRL/display/colors'

export const status: TTask = {
  name: `status`,
  alias: [`st`],
  description: `Show current authentication status`,
  example: `tdsk-agent status`,
  action: async ({ auth }) => {
    const creds = auth.getCredentials()
    if (creds) {
      process.stdout.write(`\n${bold(`Status:`)} ${cyan(`logged in`)}\n`)
      process.stdout.write(`  ${dim(`Proxy:`)} ${creds.proxyUrl}\n`)
      process.stdout.write(
        `  ${dim(`Key:`)}   ${creds.apiKey.slice(0, 8)}${'*'.repeat(8)}\n\n`
      )
    } else {
      process.stdout.write(`\n${bold(`Status:`)} ${dim(`not logged in`)}\n\n`)
    }
  },
}
