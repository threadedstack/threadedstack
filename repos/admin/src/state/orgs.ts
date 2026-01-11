import type { Organization } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const orgsState = atomWithReset<Record<string, Organization>>(undefined)
export const activeOrgIdState = atomWithReset<string>(undefined)
