import { useMemo } from 'react'
import { ERoutePath } from '@TAF/types'
import { useNavigate } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { buildNavRoute } from '@TAF/utils/nav/buildRoute'
import {
  useActiveOrgId,
  useActiveProjectId,
  useProjectSandboxes,
} from '@TAF/state/selectors'
import { Box, Chip, Paper, Stack, Button, Typography } from '@mui/material'
import {
  Add as AddIcon,
  Dns as SandboxIcon,
  Terminal as ConnectIcon,
  ChatBubbleOutline as ThreadsIcon,
} from '@mui/icons-material'

import type { Sandbox } from '@tdsk/domain'

export type TProjectWorkspace = {}

export const ProjectWorkspace = (props: TProjectWorkspace) => {
  const navigate = useNavigate()
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [projectSandboxes] = useProjectSandboxes()

  const sandboxList = useMemo<Sandbox[]>(
    () => (projectSandboxes ? Object.values(projectSandboxes) : []),
    [projectSandboxes]
  )

  const sandboxesRoute = useMemo(
    () => buildNavRoute({ orgId, projectId }, ERoutePath.ProjectSandboxes),
    [orgId, projectId]
  )

  const onNewSandbox = () => navigate(sandboxesRoute)
  const onConnect = () => navigate(sandboxesRoute)

  return (
    <Page className='tdsk-project-workspace-page'>
      {/* Quick Actions Bar */}
      <Stack
        direction='row'
        spacing={1.5}
        sx={{ mb: 3 }}
      >
        <Button
          size='small'
          variant='contained'
          startIcon={<AddIcon />}
          onClick={onNewSandbox}
        >
          New Sandbox
        </Button>
        <Button
          size='small'
          variant='outlined'
          startIcon={<ConnectIcon />}
          onClick={onConnect}
        >
          Connect
        </Button>
      </Stack>

      {/* Sandboxes Panel */}
      <Paper
        variant='outlined'
        sx={{ mb: 3, p: 2 }}
      >
        <Typography
          variant='subtitle1'
          fontWeight='bold'
          sx={{ mb: 1.5 }}
        >
          Sandboxes
        </Typography>

        {sandboxList.length === 0 ? (
          <Typography
            variant='body2'
            color='text.secondary'
          >
            No sandbox configs in this project yet.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {sandboxList.map((sb) => (
              <Paper
                key={sb.id}
                variant='outlined'
                sx={{
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                onClick={() => navigate(sandboxesRoute)}
              >
                <SandboxIcon
                  fontSize='small'
                  sx={{ color: 'text.secondary' }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction='row'
                    alignItems='center'
                    spacing={1}
                  >
                    <Typography
                      variant='body2'
                      fontWeight='medium'
                      noWrap
                    >
                      {sb.name}
                    </Typography>
                    {sb.builtIn && (
                      <Chip
                        label='built-in'
                        size='small'
                        color='info'
                        variant='outlined'
                      />
                    )}
                  </Stack>
                  <Stack
                    direction='row'
                    spacing={1}
                    sx={{ mt: 0.25 }}
                  >
                    {sb.config?.runtime && (
                      <Typography
                        variant='caption'
                        color='text.secondary'
                      >
                        {sb.config.runtime}
                      </Typography>
                    )}
                    {sb.config?.image && (
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        fontFamily='monospace'
                        noWrap
                      >
                        {sb.config.image}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      {/* Recent Threads Panel */}
      <Paper
        variant='outlined'
        sx={{ p: 2 }}
      >
        <Typography
          variant='subtitle1'
          fontWeight='bold'
          sx={{ mb: 1.5 }}
        >
          Recent Threads
        </Typography>
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}
        >
          <ThreadsIcon fontSize='small' />
          <Typography
            variant='body2'
            color='text.secondary'
          >
            Thread activity will appear here.
          </Typography>
        </Box>
      </Paper>
    </Page>
  )
}

export default ProjectWorkspace
