import { Page } from '@TAF/pages/Page/Page'
import { Providers } from '@TAF/components/Providers/Providers'
import { useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'

export type TProjectProviders = {}

export const ProjectProviders = (props: TProjectProviders) => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()

  return (
    <Page className='tdsk-project-providers-page'>
      <Providers
        readOnly
        orgId={orgId}
        projectId={projectId}
      />
    </Page>
  )
}

export default ProjectProviders
