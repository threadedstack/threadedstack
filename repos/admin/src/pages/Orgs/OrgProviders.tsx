import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId } from '@TAF/state/selectors'
import { Providers } from '@TAF/components/Providers/Providers'

export type TOrgProviders = {}

export const OrgProviders = (props: TOrgProviders) => {
  const [orgId] = useActiveOrgId()
  return (
    <Page className='tdsk-org-providers-page'>
      <Providers orgId={orgId} />
    </Page>
  )
}

export default OrgProviders
