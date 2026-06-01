import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { resolveContext } from '@TSA/utils/tasks/resolveContext'
import { resolveInstanceId } from '@TSA/utils/tasks/resolveInstanceId'
import { SandboxOptions, InstanceOptions } from '@TSA/constants/options'

export const openTask: TTask = {
  name: `open`,
  description: `Print the URL for an exposed port`,
  example: `tsa ports open 3000 [--sandbox <id>]`,
  options: { ...SandboxOptions, ...InstanceOptions },
  action: ensureAuth(async ({ params, auth, config, options }) => {
    const portStr = options?.[0] as string | undefined
    if (!portStr || !/^\d+$/.test(portStr)) {
      process.stderr.write(`Usage: tsa ports open <port> [--sandbox <id>]\n`)
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

    const { data, error } = await client.listPorts(
      ctx.orgId,
      ctx.projectId,
      ctx.sandboxId,
      instanceOpts.instanceId
    )
    if (error || !data) {
      process.stderr.write(
        `${themed(`error`, `Error:`)} ${error?.message || `Failed to list ports`}\n`
      )
      process.exit(1)
    }

    const portCfg = data.exposed[String(port)]
    if (!portCfg) {
      process.stderr.write(
        `${themed(`error`, `Error:`)} Port ${port} is not exposed. Use ${themed(`bold`, `tsa ports add ${port}`)} first.\n`
      )
      process.exit(1)
    }

    if (!data.portUrlTemplate)
      return process.stderr.write(
        `${themed(`warning`, `Warning:`)} Could not determine port URL — subdomain not available\n`
      )

    const url = data.portUrlTemplate.replace(`{port}`, String(port))
    process.stdout.write(`${url}\n`)
  }),
}
