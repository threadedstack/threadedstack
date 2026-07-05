import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId } from '@TAF/state/selectors'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PermissionGate } from '@TAF/components/Permissions/PermissionGate'
import { Verifications } from '@TAF/components/Verifications/Verifications'

export const OrgVerifications = () => {
  const [orgId] = useActiveOrgId()
  return (
    <Page className='tdsk-org-verifications-page'>
      <PermissionGate
        action={EPermAction.read}
        resource={EPermResource.verification}
        fallback={
          <EmptyState message='You do not have permission to view verifications.' />
        }
      >
        <Verifications orgId={orgId} />
      </PermissionGate>
    </Page>
  )
}

export default OrgVerifications
