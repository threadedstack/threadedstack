import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId } from '@TAF/state/selectors'
import { Sandboxes } from '@TAF/components/Sandboxes/Sandboxes'

export type TOrgSandboxes = {}

export const OrgSandboxes = (props: TOrgSandboxes) => {
  const [orgId] = useActiveOrgId()
  return (
    <Page className='tdsk-org-sandboxes-page'>
      <Sandboxes orgId={orgId} />
    </Page>
  )
}

export default OrgSandboxes
