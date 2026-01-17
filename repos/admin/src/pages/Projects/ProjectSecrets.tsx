import { useParams } from 'react-router'
import { useEffect } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { Secrets } from '@TAF/components/Secrets/Secrets'
import { setActiveOrgId, setActiveProjectId } from '@TAF/state/accessors'

export type TProjectSecrets = {}

export const ProjectSecrets = (props: TProjectSecrets) => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>()

  useEffect(() => {
    if (orgId) setActiveOrgId(orgId)
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
