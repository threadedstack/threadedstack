import { useParams } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { Providers } from '@TAF/components/Providers/Providers'

export type TOrgProviders = {}

export const OrgProviders = (props: TOrgProviders) => {
  const { orgId } = useParams<{ orgId: string }>()

  return (
    <Page className='tdsk-org-providers-page'>
      <Providers orgId={orgId} />
    </Page>
  )
}

export default OrgProviders
