import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { resolveContext } from '@TSA/utils/tasks/resolveContext'
import { resolveInstanceId } from '@TSA/utils/tasks/resolveInstanceId'
import { SandboxOptions, InstanceOptions } from '@TSA/constants/options'
import { formatPortsOutput } from '@TSA/utils/sandbox/formatPortsOutput'

export const listTask: TTask = {
  name: `list`,
  alias: [`ls`],
  description: `List exposed and detected ports`,
  example: `tsa ports list <sandbox>`,
  options: { ...SandboxOptions, ...InstanceOptions },
  action: ensureAuth(async ({ params, auth, config, options }) => {
    const client = new ApiClient(auth)
    const ctx = await resolveContext({
      client,
      config,
      explicitOrg: params.org as string | undefined,
      explicitProject: params.project as string | undefined,
      explicitSandbox: (params.sandbox || options?.[0]) as string | undefined,
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

    formatPortsOutput(data)
  }),
}
