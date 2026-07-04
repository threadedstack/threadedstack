import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId } from '@TAF/state/selectors'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PermissionGate } from '@TAF/components/Permissions/PermissionGate'
import { TaskProposals } from '@TAF/components/TaskProposals/TaskProposals'

export const OrgTaskProposals = () => {
  const [orgId] = useActiveOrgId()
  return (
    <Page className='tdsk-org-task-proposals-page'>
      <PermissionGate
        action={EPermAction.read}
        resource={EPermResource.taskProposal}
        fallback={
          <EmptyState message='You do not have permission to view task proposals.' />
        }
      >
        <TaskProposals orgId={orgId} />
      </PermissionGate>
    </Page>
  )
}

export default OrgTaskProposals
