import type { TAgentStatus } from '@TAF/types/agentActivity.types'

import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import { Text, Chip } from '@tdsk/components'
import { relativeTime, absoluteTime } from '@TAF/utils/agentActivity/formatTime'

export type TAgentStatusHeader = {
  /** `undefined` = not fetched yet, `null` = fetched and the agent never ran. */
  status?: TAgentStatus | null
}

const barSx = {
  px: 2.5,
  py: 1.5,
  gap: 2,
  display: `flex`,
  flexWrap: `wrap`,
  alignItems: `center`,
  borderRadius: 2,
  border: `1px solid`,
  borderColor: `divider`,
  bgcolor: `background.paper`,
  justifyContent: `space-between`,
} as const

/** A single labelled metric cell in the status bar. */
const Metric = (props: { label: string; value: string; title?: string }) => (
  <Box
    title={props.title}
    sx={{ minWidth: 64, textAlign: `center` }}
  >
    <Text sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{props.value}</Text>
    <Text
      sx={{
        fontSize: 11,
        letterSpacing: 0.6,
        textTransform: `uppercase`,
        color: `text.secondary`,
      }}
    >
      {props.label}
    </Text>
  </Box>
)

/**
 * The agent's liveness at a glance, as a slim bar rather than a wall of text: a
 * pulsing state chip on the left, compact metric cells on the right. `degraded`
 * is rendered straight from the watchdog's flag rather than recomputed here, so
 * there is exactly one source of truth for agent health.
 */
export const AgentStatusHeader = (props: TAgentStatusHeader) => {
  const { status } = props

  if (status === undefined)
    return (
      <Box
        data-testid='agent-status-skeleton'
        sx={barSx}
      >
        <Skeleton
          variant='rounded'
          width={160}
          height={26}
        />
        <Stack
          direction='row'
          spacing={3}
        >
          <Skeleton width={48} height={40} />
          <Skeleton width={48} height={40} />
          <Skeleton width={64} height={40} />
        </Stack>
      </Box>
    )

  if (status === null)
    return (
      <Box sx={{ ...barSx, justifyContent: `flex-start`, gap: 1.5 }}>
        <Chip
          tone='neutral'
          size='sm'
          label='never run'
        />
        <Text sx={{ color: `text.secondary`, fontSize: 14 }}>
          No activity recorded for this agent yet.
        </Text>
      </Box>
    )

  const degraded = Boolean(status.degraded)

  return (
    <Box sx={barSx}>
      <Box
        data-testid={degraded ? `agent-degraded` : undefined}
        sx={{ display: `flex`, alignItems: `center`, gap: 1.5, minWidth: 0 }}
      >
        <Chip
          size='sm'
          pulse={!degraded}
          tone={degraded ? `error` : `success`}
          label={degraded ? `degraded` : status.currentActivity || `idle`}
        />
        <Text sx={{ fontSize: 12, color: `text.secondary` }}>
          {degraded ? `watchdog flagged this agent` : `live · refreshes every 5s`}
        </Text>
      </Box>

      <Stack
        direction='row'
        spacing={2.5}
        alignItems='center'
        divider={<Divider orientation='vertical' flexItem />}
      >
        <Metric
          label='Turns'
          value={String(status.turnCount ?? 0)}
        />
        <Metric
          label='Queue'
          value={String(status.queueDepth ?? 0)}
        />
        <Metric
          label='Last turn'
          title={absoluteTime(status.lastTurnAt)}
          value={relativeTime(status.lastTurnAt) || `—`}
        />
      </Stack>
    </Box>
  )
}
