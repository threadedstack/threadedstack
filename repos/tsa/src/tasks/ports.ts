import type { TTask } from '@TSA/types'
import type { TProto, TPortsResponse } from '@tdsk/domain'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { resolveContext } from '@TSA/utils/tasks/resolveContext'
import { resolveInstanceId } from '@TSA/utils/tasks/resolveInstanceId'
import { SandboxOptions, InstanceOptions } from '@TSA/constants/options'

const formatPortsOutput = (data: TPortsResponse): void => {
  const { instanceId, exposed, detected } = data

  const exposedKeys = Object.keys(exposed)
  process.stdout.write(
    `\n${themed(`bold`, `Ports for instance`)} ${instanceId.slice(-16)}\n\n`
  )

  if (exposedKeys.length > 0) {
    process.stdout.write(`  ${themed(`primary`, `Exposed:`)}\n`)
    for (const [port, cfg] of Object.entries(exposed)) {
      process.stdout.write(`    ${themed(`bold`, port)} (${cfg.protocol})\n`)
    }
    process.stdout.write(`\n`)
  }

  if (detected.length > 0) {
    process.stdout.write(`  ${themed(`muted`, `Detected (not exposed):`)}\n`)
    for (const d of detected) {
      process.stdout.write(`    ${themed(`muted`, String(d.port))} (${d.protocol})\n`)
    }
    process.stdout.write(`\n`)
  }

  if (exposedKeys.length === 0 && detected.length === 0) {
    process.stdout.write(`  ${themed(`muted`, `No ports found`)}\n\n`)
  }
}

const listTask: TTask = {
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

const addTask: TTask = {
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

const removeTask: TTask = {
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

const openTask: TTask = {
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

export const ports: TTask = {
  name: `ports`,
  alias: [`port`, `po`],
  description: `Manage exposed ports on a sandbox instance`,
  example: `tsa ports [<sandbox>] [--org <id>] [--project <id>]`,
  options: { ...SandboxOptions, ...InstanceOptions },
  tasks: {
    add: addTask,
    open: openTask,
    list: listTask,
    remove: removeTask,
  },
  action: async (ctx) => {
    const list = ports.tasks?.list?.action
    if (list) await list(ctx)
  },
}
