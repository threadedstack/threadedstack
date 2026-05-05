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
