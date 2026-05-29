import type { Organization, User, TPermission } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { getParamValue } from '@TAF/utils/nav/getParamValue'

export type TOrgWithPerms = Organization & {
  userRole?: string
  resolvedPermissions?: TPermission[] | `super`
}

export const orgUsersState = atomWithReset<Record<string, User[]>>(undefined)
export const orgsState = atomWithReset<Record<string, TOrgWithPerms>>(undefined)
export const activeOrgIdState = atomWithReset<string>(
  getParamValue((part, before) => Boolean(before === `orgs` && part))
)

export const activeOrgRoleState = atom((get) => {
  const orgId = get(activeOrgIdState)
  const org = orgId ? get(orgsState)?.[orgId] : undefined
  return org?.userRole
})

export const activeOrgResolvedPermsState = atom((get) => {
  const orgId = get(activeOrgIdState)
  const org = orgId ? get(orgsState)?.[orgId] : undefined
  return org?.resolvedPermissions
})

export const activeOrgState = atom((get) => {
  const orgId = get(activeOrgIdState)
  return orgId ? get(orgsState)?.[orgId] : undefined
})
