import { useState } from 'react'
import { NoOrgs } from '@TAF/components/Orgs/NoOrgs'
import { OrgsGrid } from '@TAF/components/Orgs/OrgsGrid'
import { deleteOrg } from '@TAF/actions/orgs/api/deleteOrg'
import { useOrgs, useActiveOrgId } from '@TAF/state/selectors'
import { setOrgActive } from '@TAF/actions/orgs/local/setOrgActive'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { CreateOrgDialog } from '@TAF/components/Orgs/CreateOrgDialog'

export type TOrgs = {}

export const Orgs = (props: TOrgs) => {
  const [orgs] = useOrgs()
  const { isAdmin } = usePermissions()
  const [activeOrgId] = useActiveOrgId()
  const [creating, setCreating] = useState(false)

  const onCreate = () => setCreating(true)
  const onDelete = async (orgId: string) => {
    orgId && (await deleteOrg(orgId))
  }
  const onSelect = (orgId: string) => setOrgActive(orgId)

  const orgsArray = orgs ? Object.values(orgs) : []
  const noOrgs = orgsArray.length === 0

  return (
    <>
      <CreateOrgDialog
        open={creating}
        hideCreate={noOrgs}
        onCreate={onCreate}
        onClose={() => setCreating(false)}
      />
      {noOrgs ? (
        <NoOrgs onCreate={onCreate} />
      ) : (
        <>
          <OrgsGrid
            orgs={orgsArray}
            onDelete={onDelete}
            onSelect={onSelect}
            showDelete={isAdmin}
            activeOrgId={activeOrgId}
          />
        </>
      )}
    </>
  )
}
