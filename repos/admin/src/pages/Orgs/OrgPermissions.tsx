import { useMemo } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId, useOrgUsers } from '@TAF/state/selectors'
import { PermissionOverrides } from '@TAF/components/PermissionOverrides/PermissionOverrides'

export const OrgPermissions = () => {
  const [orgId] = useActiveOrgId()
  const [orgUsersMap] = useOrgUsers()

  const users = useMemo(() => {
    const usersList = orgUsersMap?.[orgId] || []
    return usersList.map((u) => ({
      id: u.id,
      name:
        u.displayName || [u.first, u.last].filter(Boolean).join(' ') || u.email || `User`,
      email: u.email,
    }))
  }, [orgUsersMap, orgId])

  return (
    <Page className='tdsk-org-permissions-page'>
      <PermissionOverrides
        orgId={orgId}
        users={users}
      />
    </Page>
  )
}

export default OrgPermissions
