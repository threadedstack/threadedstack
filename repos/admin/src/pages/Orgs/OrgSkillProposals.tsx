import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId } from '@TAF/state/selectors'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PermissionGate } from '@TAF/components/Permissions/PermissionGate'
import { SkillProposals } from '@TAF/components/SkillProposals/SkillProposals'

export const OrgSkillProposals = () => {
  const [orgId] = useActiveOrgId()
  return (
    <Page className='tdsk-org-skill-proposals-page'>
      <PermissionGate
        action={EPermAction.read}
        resource={EPermResource.skillProposal}
        fallback={
          <EmptyState message='You do not have permission to view skill proposals.' />
        }
      >
        <SkillProposals orgId={orgId} />
      </PermissionGate>
    </Page>
  )
}

export default OrgSkillProposals
