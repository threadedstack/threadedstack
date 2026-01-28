import type { Domain } from '@tdsk/domain'

import { domainsApi } from '@TAF/services'
import { upsertDomain } from '@TAF/actions/domains/local/upsertDomain'

export const updateDomain = async (id: string, input: Partial<Domain>) => {
  const resp = await domainsApi.update(id, input)

  if (resp.error) return resp
  resp.data && upsertDomain(resp.data)

  return resp
}
