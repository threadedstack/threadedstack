import type { TTask } from '@TSA/types'
import type { TProto } from '@tdsk/domain'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { resolveContext } from '@TSA/utils/tasks/resolveContext'
import { resolveInstanceId } from '@TSA/utils/tasks/resolveInstanceId'
import { SandboxOptions, InstanceOptions } from '@TSA/constants/options'

export const addTask: TTask = {
  name: `add`,
  alias: [`expose`],
  description: `Expose a port on a running sandbox instance`,
  example: `tsa ports add 3000 [--sandbox <id>]`,
  options: {
    ...SandboxOptions,
    ...InstanceOptions,
    protocol: {
      alias: [`proto`],
      example: `--protocol https`,
      description: `Port protocol (http or https, default: http)`,
    },
  },
  action: ensureAuth(async ({ params, auth, config, options }) => {
    const portStr = options?.[0] as string | undefined
    if (!portStr || !/^\d+$/.test(portStr)) {
      process.stderr.write(`Usage: tsa ports add <port> [--sandbox <id>]\n`)
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

    const { data, error } = await client.exposePort(
      ctx.orgId,
      ctx.projectId,
      ctx.sandboxId,
      instanceOpts.instanceId,
      port,
      (params.protocol as TProto) || undefined
    )
    if (error) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${error.message}\n`)
      process.exit(1)
    }

    process.stdout.write(
      `${themed(`success`, `Done:`)} Port ${themed(`bold`, String(port))} exposed\n`
    )
    if (data?.url) {
      process.stdout.write(`  ${themed(`primary`, `URL:`)} ${data.url}\n`)
    }
  }),
}
