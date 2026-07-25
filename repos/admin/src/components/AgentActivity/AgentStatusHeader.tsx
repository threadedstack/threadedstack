import type { TAgentStatus } from '@TAF/types/agentActivity.types'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { Text } from '@tdsk/components'

export type TAgentStatusHeader = {
  /** `undefined` = not fetched yet, `null` = fetched and the agent never ran. */
  status?: TAgentStatus | null
}

/**
 * The agent's liveness at a glance. `degraded` is rendered straight from the
 * watchdog's flag rather than recomputed here, so there is exactly one source
 * of truth for agent health.
 */
export const AgentStatusHeader = (props: TAgentStatusHeader) => {
  const { status } = props

  if (status === undefined)
    return <Box data-testid='agent-status-skeleton'>Loading activity…</Box>

  if (status === null)
    return <Text>No activity recorded for this agent yet.</Text>

  return (
    <Box display='flex' gap={2} alignItems='center'>
      <Text>Activity: {status.currentActivity || `idle`}</Text>
      <Text>Turns: {status.turnCount ?? 0}</Text>
      <Text>Queue: {status.queueDepth ?? 0}</Text>
      {status.lastTurnAt && <Text>Last turn: {status.lastTurnAt}</Text>}
      {status.degraded && (
        <Chip size='small' color='error' label='Degraded' data-testid='agent-degraded' />
      )}
    </Box>
  )
}
