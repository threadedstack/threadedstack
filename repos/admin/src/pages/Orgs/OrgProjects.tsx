import { Page } from '@TAF/pages/Page/Page'
import { Projects } from '@TAF/components/Projects/Projects'

export type TOrgProjects = {}

export const OrgProjects = (props: TOrgProjects) => {
  return (
    <Page className='tdsk-org-projects-page'>
      <Projects />
    </Page>
  )
}

export default OrgProjects
