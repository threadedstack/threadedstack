import { Page } from '@TAF/pages/Page/Page'
import { Domains } from '@TAF/components/Domains/Domains'
import { useActiveProjectId, useActiveOrgId } from '@TAF/state/selectors'

export type TProjectDomains = {}

export const ProjectDomains = (props: TProjectDomains) => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()

  return (
    <Page className='tdsk-project-domains-page'>
      <Domains
        orgId={orgId}
        projectId={projectId}
      />
    </Page>
  )
}

export default ProjectDomains
