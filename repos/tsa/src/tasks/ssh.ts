import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { spawnSsh } from '@TSA/utils/tasks/spawnSsh'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { InstanceOptions } from '@TSA/constants/options'
import { saveContext } from '@TSA/utils/tasks/saveContext'
import { resolveOrgId } from '@TSA/utils/tasks/resolveOrgId'
import { sandboxConnect } from '@TSA/utils/tasks/sandboxConnect'
import { resolveProjectId } from '@TSA/utils/tasks/resolveProjectId'
import { resolveSandboxId } from '@TSA/utils/tasks/resolveSandboxId'
import { resolveInstanceId } from '@TSA/utils/tasks/resolveInstanceId'
import { autoStartSync, createSyncContext, stopSync } from '@TSA/utils/tasks/sandboxSync'
import {
  clearSyncCleanup,
  registerSyncCleanup,
} from '@TSA/utils/tasks/syncCleanupRegistry'

export const ssh: TTask = {
  name: `ssh`,
  alias: [],
  description: `Connect to a running sandbox via SSH`,
  example: `tsa ssh <sandbox> [--org <id>] [--instance <id>] [--new]`,
  options: {
    sandbox: {
      example: `--sb sb_xxx`,
      description: `Sandbox ID or alias`,
      alias: [`sandboxId`, `sb`],
    },
    org: {
      example: `--org org_xxx`,
      description: `Organization ID`,
      alias: [`organizationId`, `organization`, `orgId`],
    },
    project: {
      example: `--project proj_xxx`,
      description: `Project ID`,
      alias: [`projectId`, `p`],
    },
    ...InstanceOptions,
  },
  action: ensureAuth(async ({ params, auth, config, options }) => {
    const explicitSandboxId = params.sandbox || options?.[0]
    const client = new ApiClient(auth)

    let orgId: string
    try {
      orgId = await resolveOrgId(client, params.org as string | undefined, config?.org)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    const explicitProject =
      orgId !== config?.org ? undefined : (params.project as string | undefined)

    let projectId: string
    try {
      projectId = await resolveProjectId(client, orgId, explicitProject)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    let sandboxId: string
    try {
      sandboxId = await resolveSandboxId(
        client,
        orgId,
        projectId,
        explicitSandboxId as string | undefined,
        config?.sandbox
      )
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    if (config) saveContext(config, orgId, projectId, sandboxId)

    let instanceOpts: { instanceId?: string; newInstance?: boolean } | undefined
    try {
      instanceOpts = await resolveInstanceId(client, orgId, projectId, sandboxId, {
        explicitInstance: params.instance as string | undefined,
        forceNew: params.new as boolean | undefined,
      })
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    let resolvedId: string
    let resolvedInstanceId: string | undefined
    let shellToken: string | undefined
    let workdir: string | undefined
    try {
      const connectResp = await sandboxConnect(
        client,
        orgId,
        projectId,
        sandboxId,
        instanceOpts
      )
      if (!connectResp.sandboxId)
        throw new Error(`Server did not return a resolved sandbox ID`)
      resolvedId = connectResp.sandboxId
      resolvedInstanceId = connectResp.instanceId
      shellToken = connectResp.shellToken
      workdir = connectResp.workdir
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    if (!shellToken && !auth.creds()?.apiKey) {
      process.stderr.write(
        `${themed(`error`, `Error:`)} Server did not return a tunnel token and no API key is configured.\n` +
          `${themed(`muted`, `Run "tsa login <api-key>" or update the server to resolve this.`)}\n`
      )
      process.exit(1)
    }

    const syncCtx = createSyncContext()
    try {
      await autoStartSync(
        syncCtx,
        config?.sync,
        client,
        orgId,
        resolvedId,
        resolvedInstanceId
      )
      if (syncCtx.started)
        registerSyncCleanup(resolvedId, syncCtx.manager, resolvedInstanceId)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      await stopSync(syncCtx, resolvedId, resolvedInstanceId)
      process.exit(1)
    }

    try {
      await spawnSsh(resolvedId, undefined, shellToken, workdir, resolvedInstanceId)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exitCode = 1
    } finally {
      clearSyncCleanup()
      await stopSync(syncCtx, resolvedId, resolvedInstanceId)
    }
  }),
}
