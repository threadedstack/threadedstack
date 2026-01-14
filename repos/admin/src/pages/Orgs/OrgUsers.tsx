import { useParams } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { Users } from '@TAF/components/Users/Users'

export type TOrgUsers = {}

export const OrgUsers = (props: TOrgUsers) => {
  const { orgId } = useParams<{ orgId: string }>()

  return (
    <Page className='tdsk-org-users-page'>
      <Users orgId={orgId || ''} />
    </Page>
  )
}

export default OrgUsers
