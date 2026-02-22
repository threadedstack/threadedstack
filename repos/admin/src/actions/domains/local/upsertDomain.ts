import type { Domain } from '@tdsk/domain'
import { getContextDomains, setContextDomains } from '@TAF/state/accessors'

export const upsertDomain = (contextKey: string, domain: Domain) =>
  setContextDomains(contextKey, {
    ...getContextDomains(contextKey),
    [domain.id]: domain,
  })
