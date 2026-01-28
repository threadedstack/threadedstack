import type { Domain } from '@tdsk/domain'
import { setDomains, getDomains } from '@TAF/state/accessors'

export const upsertDomains = (domains: Record<string, Domain>) =>
  setDomains({
    ...getDomains(),
    ...domains,
  })
