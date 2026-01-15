import { useParams } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { Providers } from '@TAF/components/Providers/Providers'

export type TProjectProviders = {}

export const ProjectProviders = (props: TProjectProviders) => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>()

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
