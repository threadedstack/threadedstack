import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId } from '@TAF/state/selectors'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PermissionGate } from '@TAF/components/Permissions/PermissionGate'
import { OpsActions } from '@TAF/components/OpsActions/OpsActions'

export const OrgOpsActions = () => {
  const [orgId] = useActiveOrgId()
  return (
    <Page className='tdsk-org-ops-actions-page'>
      <PermissionGate
        action={EPermAction.read}
        resource={EPermResource.opsAction}
        fallback={
          <EmptyState message='You do not have permission to view ops actions.' />
        }
      >
        <OpsActions orgId={orgId} />
      </PermissionGate>
    </Page>
  )
}

export default OrgOpsActions
