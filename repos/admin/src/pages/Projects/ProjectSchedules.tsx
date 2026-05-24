import { Page } from '@TAF/pages/Page/Page'
import { Schedules } from '@TAF/components/Schedules/Schedules'
import { useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'

export const ProjectSchedules = () => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  return (
    <Page className='tdsk-project-schedules-page'>
      <Schedules
        orgId={orgId}
        projectId={projectId}
      />
    </Page>
  )
}

export default ProjectSchedules
