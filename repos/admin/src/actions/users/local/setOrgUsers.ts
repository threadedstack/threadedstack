import type { User } from '@tdsk/domain'
import { getOrgUsers, setOrgUsers as setOrgUsersState } from '@TAF/state/accessors'

export const setOrgUsers = (orgId: string, users: User[]) => {
  const all = getOrgUsers() || {}
  setOrgUsersState({ ...all, [orgId]: users })
}
