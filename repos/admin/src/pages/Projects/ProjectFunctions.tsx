import { useParams } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { Functions } from '@TAF/components/Functions/Functions'

export type TProjectFunctions = {}

export const ProjectFunctions = (props: TProjectFunctions) => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>()

  if (!projectId) return null

  return (
    <Page className='tdsk-project-functions-page'>
      <Functions
        projectId={projectId}
        orgId={orgId}
      />
    </Page>
  )
}

export default ProjectFunctions
