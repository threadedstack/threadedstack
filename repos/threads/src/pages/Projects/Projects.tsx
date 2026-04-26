import type { Project, Sandbox } from '@tdsk/domain'

import { dims } from '@tdsk/components'
import { Page } from '@TTH/pages/Page/Page'
import { useMemo, useCallback } from 'react'
import { styled } from '@mui/material/styles'
import { useNavigate, useParams } from 'react-router'
import { useProjects, useSandboxes } from '@TTH/state/selectors'
import { selectProject } from '@TTH/actions/projects/selectProject'
import { FolderOutlined, Terminal, ChevronRight } from '@mui/icons-material'
import { Box, Card, CardActionArea, Chip, Typography } from '@mui/material'

const PageRoot = styled(Box)`
  max-width: 700px;
  margin: 0 auto;
  width: 100%;
`

const ProjectCard = styled(Card)(({ theme }) => ({
  borderRadius: dims.border.mdpx,
  transition: `box-shadow 200ms ease, border-color 200ms ease`,
  '&:hover': {
    boxShadow: theme.shadows[3],
    borderColor: theme.palette.primary.main,
  },
}))

type TProjectCardItem = {
  project: Project
  sandboxCount: number
  onSelect: (projectId: string) => void
}

const ProjectCardItem = (props: TProjectCardItem) => {
  const { project, sandboxCount, onSelect } = props

  return (
    <ProjectCard variant='outlined'>
      <CardActionArea
        onClick={() => onSelect(project.id)}
        sx={{
          p: 2.5,
          display: `flex`,
          alignItems: `center`,
          justifyContent: `flex-start`,
          gap: 2,
        }}
      >
        <FolderOutlined sx={{ fontSize: 28, color: `text.secondary` }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant='subtitle1'
            noWrap
            sx={{ fontWeight: 500 }}
          >
            {project.name}
          </Typography>
          {project.description && (
            <Typography
              variant='body2'
              color='text.secondary'
              noWrap
              sx={{ mt: 0.25 }}
            >
              {project.description}
            </Typography>
          )}
          <Box sx={{ display: `flex`, alignItems: `center`, gap: 1, mt: 0.75 }}>
            <Chip
              icon={<Terminal sx={{ fontSize: `14px !important` }} />}
              label={`${sandboxCount} ${sandboxCount === 1 ? `sandbox` : `sandboxes`}`}
              size='small'
              variant='outlined'
              sx={{ height: 22, fontSize: 11 }}
            />
            {project.branch && (
              <Chip
                label={project.branch}
                size='small'
                variant='outlined'
                sx={{ height: 22, fontSize: 11 }}
              />
            )}
          </Box>
        </Box>
        <ChevronRight sx={{ color: `text.disabled` }} />
      </CardActionArea>
    </ProjectCard>
  )
}

const EmptyState = () => (
  <Box
    sx={{
      display: `flex`,
      flexDirection: `column`,
      alignItems: `center`,
      justifyContent: `center`,
      py: 8,
      gap: 2,
    }}
  >
    <FolderOutlined sx={{ fontSize: 48, color: `text.disabled` }} />
    <Typography
      variant='body1'
      color='text.secondary'
    >
      No projects found for this organization
    </Typography>
  </Box>
)

const sandboxCountByProject = (sandboxes: Sandbox[]): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const sb of sandboxes) {
    if (sb.projects?.length) {
      for (const proj of sb.projects) {
        counts.set(proj.id, (counts.get(proj.id) ?? 0) + 1)
      }
    }
  }
  return counts
}

const Projects = () => {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const [projects] = useProjects()
  const [sandboxes] = useSandboxes()

  const sbCounts = useMemo(() => sandboxCountByProject(sandboxes), [sandboxes])

  const onSelect = useCallback(
    (projectId: string) => {
      selectProject(projectId)
      navigate(`/orgs/${orgId}/projects/${projectId}`)
    },
    [navigate, orgId]
  )

  if (!orgId) return null

  return (
    <Page className='tdsk-projects-page'>
      <PageRoot>
        <Box sx={{ mb: 3 }}>
          <Typography
            variant='h5'
            sx={{ fontWeight: 600 }}
          >
            Projects
          </Typography>
          <Typography
            variant='body2'
            color='text.secondary'
            sx={{ mt: 0.5 }}
          >
            Select a project to view its sandboxes
          </Typography>
        </Box>

        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1.5 }}>
            {projects.map((project) => (
              <ProjectCardItem
                key={project.id}
                project={project}
                onSelect={onSelect}
                sandboxCount={sbCounts.get(project.id) ?? 0}
              />
            ))}
          </Box>
        )}
      </PageRoot>
    </Page>
  )
}

export default Projects
