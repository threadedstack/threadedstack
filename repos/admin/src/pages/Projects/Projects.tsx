import { Page } from '@TAF/pages/Page/Page'
import { Projects } from '@TAF/components/Projects/Projects'

export type TProjects = {}

export const ProjectsPage = (props: TProjects) => {
  return (
    <Page className='tdsk-projects-page'>
      <Projects />
    </Page>
  )
}

export default ProjectsPage
