import { getOrgUsers, setOrgUsers } from '@TAF/state/accessors'

export const removeOrgUser = (orgId: string, userId: string) => {
  const all = getOrgUsers() || {}
  const orgUsers = all[orgId] || []
  setOrgUsers({ ...all, [orgId]: orgUsers.filter((u) => u.id !== userId) })
}
