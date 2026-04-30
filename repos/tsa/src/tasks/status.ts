import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'

export const status: TTask = {
  name: `status`,
  alias: [`st`],
  description: `Show current authentication status`,
  example: `tsa status`,
  action: async ({ auth }) => {
    const creds = auth.creds()
    if (!creds) {
      process.stdout.write(
        `\n${themed(`bold`, `Status:`)} ${themed(`muted`, `not logged in`)}\n\n`
      )
      return
    }

    process.stdout.write(
      `\n${themed(`bold`, `Status:`)} ${themed(`primary`, `logged in`)}\n`
    )
    process.stdout.write(`  ${themed(`muted`, `Proxy:`)} ${creds.proxyUrl}\n`)

    if (creds.apiKey) {
      process.stdout.write(
        `  ${themed(`muted`, `Auth:`)}  API key (${creds.apiKey.slice(0, 8)}${`*`.repeat(8)})\n\n`
      )
    } else if (creds.token) {
      const expired = auth.isExpired()
      let expiryText = ``
      if (creds.expiresAt) {
        const remaining = new Date(creds.expiresAt).getTime() - Date.now()
        if (expired) {
          expiryText = themed(`error`, ` (expired)`)
        } else {
          const mins = Math.round(remaining / 60_000)
          expiryText = themed(`muted`, ` (expires in ${mins} min)`)
        }
      }
      process.stdout.write(
        `  ${themed(`muted`, `Auth:`)}  Browser session${expiryText}\n\n`
      )
    }
  },
}
