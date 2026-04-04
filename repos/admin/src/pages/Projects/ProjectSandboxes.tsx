import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'
import { Sandboxes } from '@TAF/components/Sandboxes/Sandboxes'

export type TProjectSandboxes = {}

export const ProjectSandboxes = (props: TProjectSandboxes) => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  return (
    <Page className='tdsk-project-sandboxes-page'>
      <Sandboxes
        orgId={orgId}
        projectId={projectId}
      />
    </Page>
  )
}

export default ProjectSandboxes
