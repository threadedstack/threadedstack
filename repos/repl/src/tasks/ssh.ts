import type { TTask } from '@TRL/types'

import { tmpdir } from 'os'
import { join } from 'path'
import { themed } from '@TRL/theme'
import { spawn } from 'child_process'
import { ApiClient } from '@TRL/services/api'
import { writeFileSync, unlinkSync } from 'fs'
import { requireAuth } from '@TRL/utils/tasks/requireAuth'

export const ssh: TTask = {
  name: `ssh`,
  alias: [],
  description: `Connect to a running sandbox via SSH`,
  example: `tsa ssh <sandbox-id> [--org <id>]`,
  options: {
    sandbox: {
      example: `--sb sb_xxx`,
      description: `Sandbox ID`,
      alias: [`sandboxId`, `sb`],
    },
    org: {
      example: `--org org_xxx`,
      description: `Organization ID`,
      alias: [`organizationId`, `organization`, `orgId`],
    },
  },
  action: requireAuth(async ({ params, auth, options }) => {
    const sandboxId = params.sandbox || options?.[0]
    if (!sandboxId) {
      process.stdout.write(
        `${themed(`warning`, `Usage: tsa ssh <sandbox-id> [--org <id>]`)}\n`
      )
      process.exit(1)
    }

    const client = new ApiClient(auth)
    let orgId = params.org as string | undefined

    if (!orgId) {
      const orgs = await client.listOrgs()
      if (orgs.length === 1) {
        orgId = orgs[0].id
      } else {
        process.stdout.write(
          `${themed(`warning`, `Multiple orgs found. Use --org <id> to specify.`)}\n`
        )
        process.exit(1)
      }
    }

    process.stdout.write(
      `${themed(`muted`, `Connecting to sandbox "${sandboxId}"...`)}\n`
    )

    let connectResp: any
    try {
      connectResp = await client.connectSandbox(orgId, sandboxId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to connect`
      process.stdout.write(`${themed(`error`, `Error:`)} ${msg}\n`)
      process.exit(1)
    }

    const { password } = connectResp
    if (!password) {
      process.stdout.write(
        `${themed(`error`, `Error: No password returned from server`)}\n`
      )
      process.exit(1)
    }

    process.stdout.write(`${themed(`muted`, `SSH session ready.`)}\n`)

    const askpassPath = join(tmpdir(), `.tdsk-askpass-${Date.now()}`)
    const escaped = password.replace(/'/g, `'\\''`)
    writeFileSync(askpassPath, `#!/bin/bash\necho '${escaped}'\n`, { mode: 0o700 })

    const cleanup = () => {
      try {
        unlinkSync(askpassPath)
      } catch (err: any) {
        if (err?.code !== `ENOENT`) {
          process.stderr.write(
            `Warning: Failed to clean up askpass file ${askpassPath}: ${err.message}\n`
          )
        }
      }
    }

    process.once(`SIGINT`, cleanup)
    process.once(`SIGTERM`, cleanup)

    const tsaBin = process.argv[0] || `tsa`
    const tsaScript = process.argv[1] || ``

    const proxyCmd = tsaScript
      ? `${tsaBin} ${tsaScript} proxy ${sandboxId}`
      : `${tsaBin} proxy ${sandboxId}`

    try {
      const sshProc = spawn(
        `ssh`,
        [
          `-o`,
          `ProxyCommand=${proxyCmd}`,
          `-o`,
          `StrictHostKeyChecking=no`,
          `-o`,
          `UserKnownHostsFile=/dev/null`,
          `-o`,
          `LogLevel=ERROR`,
          `sandbox@${sandboxId}`,
        ],
        {
          stdio: `inherit`,
          env: {
            ...process.env,
            DISPLAY: `:0`,
            SSH_ASKPASS: askpassPath,
            SSH_ASKPASS_REQUIRE: `force`,
          },
        }
      )

      await new Promise<void>((resolve) => {
        sshProc.on(`close`, () => resolve())
        sshProc.on(`error`, (err) => {
          process.stderr.write(`SSH error: ${err.message}\n`)
          resolve()
        })
      })
    } finally {
      cleanup()
      process.removeListener(`SIGINT`, cleanup)
      process.removeListener(`SIGTERM`, cleanup)
    }
  }),
}
