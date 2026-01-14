import { Page } from '@TAF/pages/Page/Page'
import { useParams } from 'react-router'
import { Projects } from '@TAF/components/Projects/Projects'

export type TOrgProjects = {}

export const OrgProjects = (props: TOrgProjects) => {
  const { orgId } = useParams<{ orgId: string }>()

  if (!orgId) return null

  return (
    <Page className='tdsk-org-projects-page'>
      <Projects orgId={orgId} />
    </Page>
  )
}

export default OrgProjects
