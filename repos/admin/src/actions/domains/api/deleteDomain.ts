import { domainsApi } from '@TAF/services'
import { removeDomain } from '@TAF/actions/domains/local/removeDomain'

export const deleteDomain = async (id: string) => {
  const resp = await domainsApi.delete(id)

  if (resp.error) return resp
  removeDomain(id)

  return resp
}
