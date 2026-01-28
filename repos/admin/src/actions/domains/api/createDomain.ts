import type { Domain } from '@tdsk/domain'

import { domainsApi } from '@TAF/services'
import { upsertDomain } from '@TAF/actions/domains/local/upsertDomain'

export const createDomain = async (input: Partial<Domain>) => {
  const resp = await domainsApi.create(input)

  if (resp.error) return resp
  resp.data && upsertDomain(resp.data)

  return resp
}
