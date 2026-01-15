import type { Organization, User } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'
import { getParamValue } from '@TAF/utils/nav/getParamValue'

export const orgUsersState = atomWithReset<Record<string, User[]>>(undefined)
export const orgsState = atomWithReset<Record<string, Organization>>(undefined)
export const activeOrgIdState = atomWithReset<string>(
  getParamValue((part, before) => Boolean(before === `orgs` && part))
)
