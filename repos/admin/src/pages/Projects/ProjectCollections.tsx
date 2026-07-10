import { Page } from '@TAF/pages/Page/Page'
import { Collections } from '@TAF/components/Collections/Collections'
import { useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'

export const ProjectCollections = () => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()

  if (!orgId || !projectId) return null

  return (
    <Page className='tdsk-project-collections-page'>
      <Collections />
    </Page>
  )
}

export default ProjectCollections
