import type { Domain } from '@tdsk/domain'
import { setDomains, getDomains } from '@TAF/state/accessors'

export const upsertDomain = (domain: Domain) =>
  setDomains({
    ...getDomains(),
    [domain.id]: domain,
  })
