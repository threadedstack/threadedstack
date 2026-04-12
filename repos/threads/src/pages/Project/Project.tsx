import type { Project as TProject, Sandbox } from '@tdsk/domain'

import { useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { styled } from '@mui/material/styles'
import { Box, Card, CardActionArea, Chip, Typography } from '@mui/material'
import { dims } from '@tdsk/components'
import { Page } from '@TTH/pages/Page/Page'
import {
  useProjects,
  useSandboxes,
  useOpenSessions,
  useOrgId,
} from '@TTH/state/selectors'
import { FolderOpen, LinkOff as GitIcon, GitHub as GitHubIcon } from '@mui/icons-material'

const PageRoot = styled(Box)`
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
`

const SectionLabel = styled(Typography)(({ theme }) => ({
  textTransform: `uppercase`,
  letterSpacing: `0.5px`,
  fontSize: 11,
  fontWeight: 600,
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1.5),
}))

const SandboxCardRoot = styled(Card)(({ theme }) => ({
  borderRadius: dims.border.mdpx,
  transition: `box-shadow 200ms ease, border-color 200ms ease`,
  '&:hover': {
    boxShadow: theme.shadows[3],
    borderColor: theme.palette.primary.main,
  },
}))

const StatusChip = (props: { running: boolean }) => (
  <Chip
    size='small'
    label={props.running ? `Running` : `Stopped`}
    color={props.running ? `success` : `default`}
    variant={props.running ? `filled` : `outlined`}
    sx={{ height: 22, fontSize: 11 }}
  />
)

type TProjectSandboxCard = {
  sandbox: Sandbox
  running: boolean
}

const ProjectSandboxCard = (props: TProjectSandboxCard) => {
  const { sandbox, running } = props
  const navigate = useNavigate()
  const runtime = sandbox.config?.runtime || `custom`

  const handleClick = useCallback(() => {
    navigate(`/session/${sandbox.id}`)
  }, [navigate, sandbox.id])

  return (
    <SandboxCardRoot variant='outlined'>
      <CardActionArea
        onClick={handleClick}
        sx={{
          display: `flex`,
          flexDirection: `column`,
          alignItems: `flex-start`,
          p: 2,
          gap: 1,
        }}
      >
        <Box
          sx={{
            display: `flex`,
            alignItems: `center`,
            width: `100%`,
            gap: 1,
          }}
        >
          <Typography
            variant='subtitle1'
            noWrap
            sx={{ flex: 1, fontWeight: 500 }}
          >
            {sandbox.name}
          </Typography>
          {sandbox.builtIn && (
            <Chip
              label='Built-in'
              size='small'
              color='info'
              variant='outlined'
              sx={{ height: 20, fontSize: 10 }}
            />
          )}
        </Box>
        <Box
          sx={{
            display: `flex`,
            alignItems: `center`,
            width: `100%`,
            gap: 1,
          }}
        >
          <Chip
            label={runtime}
            size='small'
            variant='outlined'
            sx={{ height: 22, fontSize: 11 }}
          />
          <Box sx={{ flex: 1 }} />
          <StatusChip running={running} />
        </Box>
      </CardActionArea>
    </SandboxCardRoot>
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
    <FolderOpen sx={{ fontSize: 48, color: `text.disabled` }} />
    <Typography
      variant='body1'
      color='text.secondary'
    >
      No sandboxes configured for this project
    </Typography>
  </Box>
)

const NotFound = () => (
  <Page className='tdsk-project-page'>
    <Box
      sx={{
        display: `flex`,
        flexDirection: `column`,
        alignItems: `center`,
        justifyContent: `center`,
        minHeight: 300,
        gap: 2,
      }}
    >
      <Typography
        variant='h6'
        color='text.secondary'
      >
        Project not found
      </Typography>
      <Typography
        variant='body2'
        color='text.disabled'
      >
        The requested project does not exist or you do not have access.
      </Typography>
    </Box>
  </Page>
)

const GitInfo = (props: { gitUrl: string; branch: string }) => {
  const isGitHub = props.gitUrl.includes(`github.com`)
  const Icon = isGitHub ? GitHubIcon : GitIcon

  return (
    <Box
      sx={{
        display: `flex`,
        alignItems: `center`,
        gap: 0.75,
        mt: 0.5,
      }}
    >
      <Icon sx={{ fontSize: 14, color: `text.disabled` }} />
      <Typography
        variant='caption'
        color='text.disabled'
        noWrap
        sx={{ maxWidth: 400 }}
      >
        {props.gitUrl}
      </Typography>
      <Typography
        variant='caption'
        color='text.disabled'
      >
        {`\u00B7`}
      </Typography>
      <Typography
        variant='caption'
        color='text.disabled'
      >
        {props.branch}
      </Typography>
    </Box>
  )
}

const Project = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const projects = useProjects()
  const sandboxes = useSandboxes()
  const openSessions = useOpenSessions()

  const project = useMemo<TProject | undefined>(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  )

  const projectSandboxes = useMemo<Sandbox[]>(() => {
    if (!projectId) return []
    return sandboxes.filter((sb) => sb.projects?.some((p) => p.id === projectId))
  }, [sandboxes, projectId])

  if (!projectId || !project) {
    return <NotFound />
  }

  return (
    <Page className='tdsk-project-page'>
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
                  key={sandbox.id}
                  sandbox={sandbox}
                  running={openSessions.has(sandbox.id)}
                />
              ))}
            </Box>
          )}
        </Box>
      </PageRoot>
    </Page>
  )
}

export const Component = Project
export default Project
