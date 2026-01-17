import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId } from '@TAF/state/selectors'
import { Secrets } from '@TAF/components/Secrets/Secrets'

export type TOrgSecrets = {}

export const OrgSecrets = (props: TOrgSecrets) => {
  const [orgId] = useActiveOrgId()

  return (
    <Page className='tdsk-org-secrets-page'>
      <Secrets orgId={orgId} />
    </Page>
  )
}

export default OrgSecrets
