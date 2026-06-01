import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { resolveContext } from '@TSA/utils/tasks/resolveContext'
import { connectAndAttach } from '@TSA/utils/tasks/connectAndAttach'
import { resolveInstanceId } from '@TSA/utils/tasks/resolveInstanceId'
import { SandboxOptions, InstanceOptions } from '@TSA/constants/options'

export const start: TTask = {
  name: `start`,
  alias: [`new`],
  description: `Start a new plain shell session`,
  example: `tsa sessions start <sandbox-id>`,
  options: { ...SandboxOptions, ...InstanceOptions },
  action: ensureAuth(async ({ params, auth, config, options }) => {
    const sandboxIdInput = (params.sandbox || options?.[0]) as string | undefined
    if (!sandboxIdInput) {
      process.stderr.write(`Usage: tsa sessions start <sandbox-id>\n`)
      process.exit(1)
    }

    const client = new ApiClient(auth)
    const ctx = await resolveContext({
      client,
      config,
      explicitOrg: params.org as string | undefined,
      explicitProject: params.project as string | undefined,
      explicitSandbox: sandboxIdInput,
    })

    let instanceOpts: { instanceId?: string; newInstance?: boolean } | undefined
    try {
      instanceOpts = await resolveInstanceId(
        client,
        ctx.orgId,
        ctx.projectId,
        ctx.sandboxId,
        {
          explicitInstance: params.instance as string | undefined,
          forceNew: params.new as boolean | undefined,
        }
      )
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    try {
      await connectAndAttach({
        client,
        auth,
        orgId: ctx.orgId,
        projectId: ctx.projectId,
        sandboxId: ctx.sandboxId,
        instanceOpts,
        run: false,
      })
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exitCode = 1
    }
  }),
}
