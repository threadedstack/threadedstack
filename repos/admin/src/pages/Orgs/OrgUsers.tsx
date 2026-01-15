import { Page } from '@TAF/pages/Page/Page'
import { Users } from '@TAF/components/Users/Users'

export type TOrgUsers = {}

export const OrgUsers = (props: TOrgUsers) => {
  return (
    <Page className='tdsk-org-users-page'>
      <Users />
    </Page>
  )
}

export default OrgUsers
