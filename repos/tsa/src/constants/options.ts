import type { TTaskOptions } from '@TSA/types'

export const SandboxOptions: TTaskOptions = {
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
}

export const InstanceOptions: TTaskOptions = {
  instance: {
    example: `--instance abc123`,
    alias: [`instanceId`, `inst`],
    description: `Instance ID or suffix`,
  },
  new: {
    alias: [`n`],
    type: `bool`,
    example: `--new`,
    description: `Start a new instance`,
  },
}
