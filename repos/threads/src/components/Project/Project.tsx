import type { Project as TProject, Sandbox, TGitBrand } from '@tdsk/domain'

import { useMemo } from 'react'
import { useParams } from 'react-router'
import { styled } from '@mui/material/styles'
import { Box, Typography } from '@mui/material'
import { GitInfo } from '@TTH/components/Project/GitInfo'
import { NotFound } from '@TTH/components/Project/NotFound'
import { EmptyState } from '@TTH/components/Project/EmptyState'
import { useProjects, useSandboxes, useOrgId } from '@TTH/state/selectors'
import { ProjectSandboxCard } from '@TTH/components/Project/ProjectSandboxCard'

const PageRoot = styled(Box)`
  width: 100%;
  margin: 0 auto;
  max-width: 900px;
`

const SectionLabel = styled(Typography)(({ theme }) => ({
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: `0.5px`,
  textTransform: `uppercase`,
  marginBottom: theme.spacing(1.5),
  color: theme.palette.text.secondary,
}))

export const Project = () => {
  const [orgId] = useOrgId()
  const [projects] = useProjects()
  const [sandboxes] = useSandboxes()
  const { projectId } = useParams<{ projectId: string }>()

  const project = useMemo<TProject | undefined>(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  )

  const projectSandboxes = useMemo<Sandbox[]>(() => {
    if (!projectId) return []
    return sandboxes.filter((sb) => sb.projects?.some((p) => p.id === projectId))
  }, [sandboxes, projectId])

  if (!projectId || !project) return <NotFound />

  return (
    <PageRoot>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant='h4'
          sx={{ fontWeight: 600 }}
        >
          {project.name}
        </Typography>
        {project.description && (
          <Typography
            variant='body2'
            color='text.secondary'
            sx={{ mt: 0.5 }}
          >
            {project.description}
          </Typography>
        )}
        {project.gitUrl && (
          <GitInfo
            gitUrl={project.gitUrl}
            branch={project.branch || `main`}
            brand={project.primaryGitProvider?.brand as TGitBrand | undefined}
          />
        )}
      </Box>

      <Box>
        <SectionLabel>Sandboxes ({projectSandboxes.length})</SectionLabel>

        {projectSandboxes.length === 0 ? (
          <EmptyState />
        ) : (
          <Box
            sx={{
              display: `grid`,
              gridTemplateColumns: { xs: `1fr`, md: `1fr 1fr` },
              gap: 2,
            }}
          >
            {projectSandboxes.map((sandbox) => (
              <ProjectSandboxCard
                orgId={orgId}
                key={sandbox.id}
                sandbox={sandbox}
                projectId={projectId!}
              />
            ))}
          </Box>
        )}
      </Box>
    </PageRoot>
  )
}
