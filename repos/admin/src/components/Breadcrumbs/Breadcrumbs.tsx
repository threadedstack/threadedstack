import { useState } from 'react'
import { Box } from '@mui/material'
import { useActiveOrgId } from '@TAF/state/selectors'
import { ChevronRight as SeparatorIcon } from '@mui/icons-material'
import { OrgSelector } from '@TAF/components/Breadcrumbs/OrgSelector'
import { CreateOrgDrawer } from '@TAF/components/Orgs/CreateOrgDrawer'
import { ProjectSelector } from '@TAF/components/Breadcrumbs/ProjectSelector'
import { CreateProjectDrawer } from '@TAF/components/Projects/CreateProjectDrawer'

export type TBreadcrumbs = {
  className?: string
}

export const Breadcrumbs = (props: TBreadcrumbs) => {
  const { className } = props

  const [activeOrgId] = useActiveOrgId()
  const [createOrgOpen, setCreateOrgOpen] = useState(false)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)

  const onCreateOrg = () => setCreateOrgOpen(true)
  const onCreateProject = () => setCreateProjectOpen(true)

  return activeOrgId ? (
    <Box
      className={className}
      sx={{
        gap: 0.5,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <OrgSelector onCreateOrg={onCreateOrg} />

      <SeparatorIcon
        sx={{
          mx: 0.5,
          fontSize: 18,
          color: 'text.disabled',
        }}
      />
      <ProjectSelector onCreateProject={onCreateProject} />

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
    </Box>
  ) : null
}
