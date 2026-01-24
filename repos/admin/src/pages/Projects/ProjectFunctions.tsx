import { Page } from '@TAF/pages/Page/Page'
import { useActiveProjectId } from '@TAF/state/selectors'
import { Functions } from '@TAF/components/Functions/Functions'

export type TProjectFunctions = {}

export const ProjectFunctions = (props: TProjectFunctions) => {
  const [projectId] = useActiveProjectId()

  return (
    (projectId && (
      <Page className='tdsk-project-functions-page'>
        <Functions />
      </Page>
    )) ||
    null
  )
}

export default ProjectFunctions
