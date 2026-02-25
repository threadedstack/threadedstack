import { useState } from 'react'
import { Box } from '@mui/material'
import { styled } from '@mui/material/styles'
import { ChevronRight } from '@mui/icons-material'
import { useActiveOrgId } from '@TAF/state/selectors'
import { OrgSelector } from '@TAF/components/Breadcrumbs/OrgSelector'
import { CreateOrgDrawer } from '@TAF/components/Orgs/CreateOrgDrawer'
import { ProjectSelector } from '@TAF/components/Breadcrumbs/ProjectSelector'
import { CreateProjectDrawer } from '@TAF/components/Projects/CreateProjectDrawer'

export type TBreadcrumbs = {
  className?: string
}

const Container = styled(Box)`
  gap: 0.5;
  display: flex;
  align-items: center;
`

const SeparatorIcon = styled(ChevronRight)(({ theme }) => {
  return `
    font-size: 18px;
    margin-left: ${theme.gutter.qpx};
    margin-right: ${theme.gutter.qpx};
    color: ${theme.palette.text.disabled};
  `
})

export const Breadcrumbs = (props: TBreadcrumbs) => {
  const { className } = props

  const [activeOrgId] = useActiveOrgId()
  const [createOrgOpen, setCreateOrgOpen] = useState(false)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)

  return activeOrgId ? (
    <Container className={className}>
      <OrgSelector onCreateOrg={() => setCreateOrgOpen(true)} />
      <SeparatorIcon />
      <ProjectSelector onCreateProject={() => setCreateProjectOpen(true)} />

      <CreateOrgDrawer
        open={createOrgOpen}
        onClose={() => setCreateOrgOpen(false)}
      />

      {activeOrgId && (
        <CreateProjectDrawer
          open={createProjectOpen}
          onClose={() => setCreateProjectOpen(false)}
        />
      )}
    </Container>
  ) : null
}
