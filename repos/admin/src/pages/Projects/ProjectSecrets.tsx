import { Page } from '@TAF/pages/Page/Page'
import { Secrets } from '@TAF/components/Secrets/Secrets'
import { useActiveProjectId, useActiveOrgId } from '@TAF/state/selectors'
import { useProjectSecrets } from '@TAF/hooks/project/useProjectSecrets'

export type TProjectSecrets = {}

export const ProjectSecrets = (props: TProjectSecrets) => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()

  const { error, loading, secrets, setError, setLoading } = useProjectSecrets()

  return (
    <Page className='tdsk-project-secrets-page'>
      <Secrets
        orgId={orgId}
        error={error}
        loading={loading}
        secrets={secrets}
        setError={setError}
        projectId={projectId}
        setLoading={setLoading}
      />
    </Page>
  )
}

export default ProjectSecrets
