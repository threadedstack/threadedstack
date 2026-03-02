import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId } from '@TAF/state/selectors'
import { Schedules } from '@TAF/components/Schedules/Schedules'

export const OrgSchedules = () => {
  const [orgId] = useActiveOrgId()
  return (
    <Page className='tdsk-org-schedules-page'>
      <Schedules orgId={orgId} />
    </Page>
  )
}

export default OrgSchedules
