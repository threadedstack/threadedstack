import { sandboxApi } from '@TTH/services/sandboxApi'

export type TListSandboxesOpts = { orgId: string }

export const listSandboxes = async (opts: TListSandboxesOpts) => {
  return sandboxApi.list(opts.orgId)
}
