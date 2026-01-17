import { Page } from '@TAF/pages/Page/Page'
import { Secrets } from '@TAF/components/Secrets/Secrets'
import { useActiveProjectId, useActiveOrgId } from '@TAF/state/selectors'

export type TProjectSecrets = {}

export const ProjectSecrets = (props: TProjectSecrets) => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()

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
