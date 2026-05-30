import type { ComponentType } from 'react'

import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import BuildIcon from '@mui/icons-material/Build'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import {
  RobotIcon,
  OpenAIIcon,
  ClaudeIcon,
  OpenClawIcon,
  OpenCodeIcon,
  AntigravityIcon,
  RobotOutlineIcon,
} from '@tdsk/components'

type AgentEntry = {
  name: string
  icon: ComponentType<{ sx?: object }>
  iconColor: string
}

const agents: AgentEntry[] = [
  { name: 'Claude Code', icon: ClaudeIcon, iconColor: 'primary.main' },
  { name: 'Codex', icon: OpenAIIcon, iconColor: 'primary.main' },
  { name: 'OpenCode', icon: OpenCodeIcon, iconColor: 'primary.main' },
  { name: 'OpenClaw', icon: OpenClawIcon, iconColor: 'primary.main' },
  { name: 'Antigravity', icon: AntigravityIcon, iconColor: 'primary.main' },
  { name: 'Custom', icon: BuildIcon, iconColor: 'text.secondary' },
]

const tileSx = {
  width: 56,
  height: 56,
  borderRadius: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  bgcolor: (t: any) =>
    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  border: 1,
  borderColor: 'divider',
} as const

const AgentStrip = () => (
  <Box sx={{ py: { xs: 4, md: 6 } }}>
    <Container
      maxWidth='lg'
      sx={{ textAlign: 'center' }}
    >
      <Typography
        variant='overline'
        sx={{
          color: 'text.secondary',
          letterSpacing: 2,
          fontWeight: 600,
          display: 'block',
          mb: 3,
        }}
      >
        Works with the tools your team already uses
      </Typography>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: { xs: 2, md: 4 },
          mb: 3,
        }}
      >
        {agents.map((agent) => {
          const Icon = agent.icon
          return (
            <Box
              key={agent.name}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box sx={tileSx}>
                <Icon sx={{ fontSize: 28, color: agent.iconColor }} />
              </Box>
              <Typography
                variant='caption'
                color='text.secondary'
                sx={{ fontWeight: 500 }}
              >
                {agent.name}
              </Typography>
            </Box>
          )
        })}
      </Box>
      <Typography
        variant='body2'
        color='text.secondary'
      >
        Bring your own AI tool. We handle sandboxing, credentials, and collaboration.
      </Typography>
    </Container>
  </Box>
)

export default AgentStrip
