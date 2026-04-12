import { threadsApi } from '@TTH/services/threadsApi'

export type TViewThreadOpts = { orgId: string; sandboxId: string; threadId: string }

export const viewThread = async (opts: TViewThreadOpts) => {
  return threadsApi.messages(opts.orgId, opts.sandboxId, opts.threadId)
}
