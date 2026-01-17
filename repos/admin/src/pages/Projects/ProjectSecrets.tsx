import { useParams } from 'react-router'
import { useEffect } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId } from '@TAF/state/selectors'
import { Secrets } from '@TAF/components/Secrets/Secrets'
import { setActiveProjectId } from '@TAF/state/accessors'

export type TProjectSecrets = {}

export const ProjectSecrets = (props: TProjectSecrets) => {
  const [orgId] = useActiveOrgId()
  const { projectId } = useParams<{ projectId: string }>()

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId)
  }, [orgId, projectId])

  return (
    <Page className='tdsk-project-secrets-page'>
      <Secrets
        orgId={orgId}
        projectId={projectId}
      />
    </Page>
  )
}

export default ProjectSecrets
