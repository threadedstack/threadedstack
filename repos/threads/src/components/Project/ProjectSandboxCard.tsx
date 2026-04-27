import type { Sandbox } from '@tdsk/domain'

import { useCallback } from 'react'
import { dims } from '@tdsk/components'
import { nav } from '@TTH/services/nav'
import { styled } from '@mui/material/styles'
import { StatusChip } from '@TTH/components/Project/StatusChip'
import { Box, Card, CardActionArea, Chip, Typography } from '@mui/material'
import { useSandboxHasSession } from '@TTH/hooks/sandbox/useSandboxHasSession'

const SandboxCardRoot = styled(Card)(({ theme }) => ({
  borderRadius: dims.border.mdpx,
  transition: `box-shadow 200ms ease, border-color 200ms ease`,
  '&:hover': {
    boxShadow: theme.shadows[3],
    borderColor: theme.palette.primary.main,
  },
}))

export type TProjectSandboxCard = {
  sandbox: Sandbox
  orgId: string
  projectId: string
}

export const ProjectSandboxCard = (props: TProjectSandboxCard) => {
  const { sandbox, orgId, projectId } = props
  const running = useSandboxHasSession(sandbox.id)
  const runtime = sandbox.config?.runtime || `custom`

  const handleClick = useCallback(() => {
    nav.sandbox(orgId, projectId, sandbox.id)
  }, [orgId, projectId, sandbox.id])

  return (
    <SandboxCardRoot variant='outlined'>
      <CardActionArea
        onClick={handleClick}
        sx={{
          p: 2,
          gap: 1,
          display: `flex`,
          flexDirection: `column`,
          alignItems: `flex-start`,
        }}
      >
        <Box
          sx={{
            gap: 1,
            width: `100%`,
            display: `flex`,
            alignItems: `center`,
          }}
        >
          <Typography
            noWrap
            variant='subtitle1'
            sx={{ flex: 1, fontWeight: 500 }}
          >
            {sandbox.name}
          </Typography>
          {sandbox.builtIn && (
            <Chip
              size='small'
              color='info'
              label='Built-in'
              variant='outlined'
              sx={{ height: 20, fontSize: 10 }}
            />
          )}
        </Box>
        <Box
          sx={{
            gap: 1,
            width: `100%`,
            display: `flex`,
            alignItems: `center`,
          }}
        >
          <Chip
            size='small'
            label={runtime}
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
