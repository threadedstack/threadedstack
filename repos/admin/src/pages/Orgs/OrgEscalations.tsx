import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId } from '@TAF/state/selectors'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PermissionGate } from '@TAF/components/Permissions/PermissionGate'
import { Escalations } from '@TAF/components/Escalations/Escalations'

export const OrgEscalations = () => {
  const [orgId] = useActiveOrgId()
  return (
    <Page className='tdsk-org-escalations-page'>
      <PermissionGate
        action={EPermAction.read}
        resource={EPermResource.escalation}
        fallback={
          <EmptyState message='You do not have permission to view escalations.' />
        }
      >
        <Escalations orgId={orgId} />
      </PermissionGate>
    </Page>
  )
}

export default OrgEscalations
