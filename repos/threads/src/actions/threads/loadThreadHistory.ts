import { threadsApi } from '@TTH/services/threadsApi'

export type TLoadThreadHistoryOpts = { orgId: string; sandboxId: string }

export const loadThreadHistory = async (opts: TLoadThreadHistoryOpts) => {
  return threadsApi.listBySandbox(opts.orgId, opts.sandboxId)
}
