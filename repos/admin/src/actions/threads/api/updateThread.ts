import type { Thread } from '@tdsk/domain'

import { threadsApi } from '@TAF/services'
import { upsertThread } from '@TAF/actions/threads/local/upsertThread'

export const updateThread = async (id: string, data: Partial<Thread>) => {
  const resp = await threadsApi.update(id, data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertThread(resp.data)

  return resp
}
