import { useState } from 'react'
import { Box } from '@mui/material'
import { useActiveOrgId } from '@TAF/state/selectors'
import { OrgSelector } from '@TAF/components/Header/OrgSelector'
import { ChevronRight as SeparatorIcon } from '@mui/icons-material'
import { CreateOrgDialog } from '@TAF/components/Orgs/CreateOrgDialog'
import { ProjectSelector } from '@TAF/components/Header/ProjectSelector'
import { CreateProjectDialog } from '@TAF/components/Projects/CreateProjectDialog'

export type TBreadcrumbNav = {
  className?: string
}

export const BreadcrumbNav = (props: TBreadcrumbNav) => {
  const { className } = props

  const [activeOrgId] = useActiveOrgId()
  const [createOrgOpen, setCreateOrgOpen] = useState(false)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)

  const onCreateOrg = () => setCreateOrgOpen(true)
  const onCreateProject = () => setCreateProjectOpen(true)

  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
      }}
    >
      <OrgSelector onCreateOrg={onCreateOrg} />

      {activeOrgId && (
        <>
          <SeparatorIcon
            sx={{
              fontSize: 18,
              color: 'text.disabled',
              mx: 0.5,
            }}
          />
          <ProjectSelector onCreateProject={onCreateProject} />
        </>
      )}

      <CreateOrgDialog
        open={createOrgOpen}
        onClose={() => setCreateOrgOpen(false)}
      />

      {activeOrgId && (
        <CreateProjectDialog
          orgId={activeOrgId}
          open={createProjectOpen}
          onClose={() => setCreateProjectOpen(false)}
        />
      )}
    </Box>
  )
}
