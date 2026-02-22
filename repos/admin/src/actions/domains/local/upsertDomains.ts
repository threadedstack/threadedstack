import type { Domain } from '@tdsk/domain'
import { getContextDomains, setContextDomains } from '@TAF/state/accessors'

export const upsertDomains = (contextKey: string, domains: Record<string, Domain>) =>
  setContextDomains(contextKey, {
    ...getContextDomains(contextKey),
    ...domains,
  })
