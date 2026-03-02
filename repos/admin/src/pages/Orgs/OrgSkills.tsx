import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId } from '@TAF/state/selectors'
import { Skills } from '@TAF/components/Skills/Skills'

export const OrgSkills = () => {
  const [orgId] = useActiveOrgId()
  return (
    <Page className='tdsk-org-skills-page'>
      <Skills orgId={orgId} />
    </Page>
  )
}

export default OrgSkills
