import type { ApiClient } from '@TSA/services/api'
import type { TTsaConfig } from '@TSA/types'

import { themed } from '@TSA/theme'
import { saveContext } from '@TSA/utils/tasks/saveContext'
import { resolveOrgId } from '@TSA/utils/tasks/resolveOrgId'
import { resolveProjectId } from '@TSA/utils/tasks/resolveProjectId'
import { resolveSandboxId } from '@TSA/utils/tasks/resolveSandboxId'

export type TResolvedBase = {
  client: ApiClient
  orgId: string
  projectId: string
}

export type TResolvedContext = TResolvedBase & {
  sandboxId: string
}

type TResolveContextArgs = {
  client: ApiClient
  config?: TTsaConfig
  explicitOrg?: string
  skipSandbox?: boolean
  explicitProject?: string
  explicitSandbox?: string
}

const resolveOrgAndProject = async (
  args: Pick<TResolveContextArgs, `client` | `config` | `explicitOrg` | `explicitProject`>
): Promise<TResolvedBase> => {
  const { client, config, explicitOrg, explicitProject } = args

  let orgId: string
  try {
    orgId = await resolveOrgId(client, explicitOrg, config?.org)
  } catch (err) {
    process.stderr.write(
      `${themed(`error`, `Error:`)} ${err instanceof Error ? err.message : String(err)}\n`
    )
    process.exit(1)
  }

  // Switching orgs invalidates the cached project — force re-selection
  const projectParam = orgId !== config?.org ? undefined : explicitProject

  let projectId: string
  try {
    projectId = await resolveProjectId(client, orgId, projectParam)
  } catch (err) {
    process.stderr.write(
      `${themed(`error`, `Error:`)} ${err instanceof Error ? err.message : String(err)}\n`
    )
    process.exit(1)
  }

  return { client, orgId, projectId }
}

export async function resolveContext(
  args: TResolveContextArgs & { skipSandbox: true }
): Promise<TResolvedBase>
export async function resolveContext(
  args: TResolveContextArgs & { skipSandbox?: false }
): Promise<TResolvedContext>
export async function resolveContext(
  args: TResolveContextArgs
): Promise<TResolvedBase | TResolvedContext> {
  const { config, skipSandbox, explicitSandbox } = args

  const base = await resolveOrgAndProject(args)

  if (skipSandbox) {
    if (config) saveContext(config, base.orgId, base.projectId)
    return base
  }

  let sandboxId: string
  try {
    sandboxId = await resolveSandboxId(
      base.client,
      base.orgId,
      base.projectId,
      explicitSandbox,
      config?.sandbox
    )
  } catch (err) {
    process.stderr.write(
      `${themed(`error`, `Error:`)} ${err instanceof Error ? err.message : String(err)}\n`
    )
    process.exit(1)
  }

  if (config) saveContext(config, base.orgId, base.projectId, sandboxId)

  return { ...base, sandboxId }
}
