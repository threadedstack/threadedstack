import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId } from '@TAF/state/selectors'
import { Secrets } from '@TAF/components/Secrets/Secrets'
import { useOrgSecrets } from '@TAF/hooks/org/useOrgSecrets'

export type TOrgSecrets = {}

export const OrgSecrets = (props: TOrgSecrets) => {
  const [orgId] = useActiveOrgId()

  const { error, loading, secrets, setError, setLoading } = useOrgSecrets({ orgId })

  return (
    <Page className='tdsk-org-secrets-page'>
      <Secrets
        orgId={orgId}
        error={error}
        loading={loading}
        secrets={secrets}
        setError={setError}
        setLoading={setLoading}
      />
    </Page>
  )
}

export default OrgSecrets
