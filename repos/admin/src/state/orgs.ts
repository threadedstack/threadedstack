import type { Organization, User } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { getParamValue } from '@TAF/utils/nav/getParamValue'

export const orgUsersState = atomWithReset<Record<string, User[]>>(undefined)
export const orgsState = atomWithReset<Record<string, Organization>>(undefined)
export const activeOrgIdState = atomWithReset<string>(
  getParamValue((part, before) => Boolean(before === `orgs` && part))
)

export const activeOrgRoleState = atomWithReset<string | undefined>(undefined)

export const activeOrgState = atom((get) => {
  const orgId = get(activeOrgIdState)
  const orgs = get(orgsState)
  return orgId && orgs?.[orgId] ? orgs[orgId] : undefined
})
