import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { resolveContext } from '@TSA/utils/tasks/resolveContext'
import { resolveInstanceId } from '@TSA/utils/tasks/resolveInstanceId'
import { SandboxOptions, InstanceOptions } from '@TSA/constants/options'

export const removeTask: TTask = {
  name: `remove`,
  alias: [`rm`, `unexpose`],
  description: `Remove an exposed port`,
  example: `tsa ports remove 3000 [--sandbox <id>]`,
  options: { ...SandboxOptions, ...InstanceOptions },
  action: ensureAuth(async ({ params, auth, config, options }) => {
    const portStr = options?.[0] as string | undefined
    if (!portStr || !/^\d+$/.test(portStr)) {
      process.stderr.write(`Usage: tsa ports remove <port> [--sandbox <id>]\n`)
      process.exit(1)
    }

    const port = Number(portStr)
    const client = new ApiClient(auth)
    const ctx = await resolveContext({
      client,
      config,
      explicitOrg: params.org as string | undefined,
      explicitProject: params.project as string | undefined,
      explicitSandbox: params.sandbox as string | undefined,
    })

    const instanceOpts = await resolveInstanceId(
      client,
      ctx.orgId,
      ctx.projectId,
      ctx.sandboxId,
      { explicitInstance: params.instance as string | undefined }
    )

    if (!instanceOpts?.instanceId) {
      process.stderr.write(`${themed(`error`, `Error:`)} No running instance found\n`)
      process.exit(1)
    }

    const { error } = await client.removePort(
      ctx.orgId,
      ctx.projectId,
      ctx.sandboxId,
      port,
      instanceOpts.instanceId
    )
    if (error) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${error.message}\n`)
      process.exit(1)
    }

    process.stdout.write(
      `${themed(`success`, `Done:`)} Port ${themed(`bold`, String(port))} removed\n`
    )
  }),
}
