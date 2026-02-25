import type { Domain } from '@tdsk/domain'
import { setContextDomains } from '@TAF/state/accessors'

export const setDomains = (contextKey: string, domains: Domain[]) => {
  const map =
    domains?.reduce((acc: Record<string, Domain>, domain: Domain) => {
      acc[domain.id] = domain
      return acc
    }, {}) || {}

  setContextDomains(contextKey, map)
}
