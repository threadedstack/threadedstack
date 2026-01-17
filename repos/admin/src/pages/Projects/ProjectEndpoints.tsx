import { Page } from '@TAF/pages/Page/Page'
import { useActiveProjectId } from '@TAF/state/selectors'
import { Endpoints } from '@TAF/components/Endpoints/Endpoints'

export type TProjectEndpoints = {}

export const ProjectEndpoints = (props: TProjectEndpoints) => {
  const [projectId] = useActiveProjectId()
  if (!projectId) return null

  return (
    <Page className='tdsk-project-endpoints-page'>
      <Endpoints />
    </Page>
  )
}

export default ProjectEndpoints
