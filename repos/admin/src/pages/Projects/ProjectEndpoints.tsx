import { useParams } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { Endpoints } from '@TAF/components/Endpoints/Endpoints'

export type TProjectEndpoints = {}

export const ProjectEndpoints = (props: TProjectEndpoints) => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>()

  if (!projectId) return null

  return (
    <Page className='tdsk-project-endpoints-page'>
      <Endpoints
        projectId={projectId}
        orgId={orgId}
      />
    </Page>
  )
}

export default ProjectEndpoints
