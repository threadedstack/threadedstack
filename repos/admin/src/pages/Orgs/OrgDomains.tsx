import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId } from '@TAF/state/selectors'
import { Domains } from '@TAF/components/Domains/Domains'

export type TOrgDomains = {}

export const OrgDomains = (props: TOrgDomains) => {
  const [orgId] = useActiveOrgId()

  return (
    <Page className='tdsk-org-domains-page'>
      <Domains orgId={orgId} />
    </Page>
  )
}

export default OrgDomains
