import type { Domain } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const domainsState = atomWithReset<Record<string, Domain>>(undefined)
export const activeDomainIdState = atomWithReset<string>(undefined)
