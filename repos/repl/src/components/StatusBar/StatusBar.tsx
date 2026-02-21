import type { TConnectionStatus } from '@TRL/types'

import { Box, Text } from 'ink'
import { themed } from '@TRL/theme'
import { ConnectionColors } from '@TRL/constants'

type TStatusBar = {
  agentName: string
  modelName?: string
  threadName?: string
  providerName?: string
  connection: TConnectionStatus
}

export const StatusBar = (props: TStatusBar) => {
  const { agentName, modelName, threadName, connection, providerName } = props

  return (
    <Box>
      <Text>
        {themed('border', '── ')}
        {themed('muted', agentName)}
        {providerName
          ? `${themed('border', ' · ')}${themed('muted', `${providerName}${modelName ? ` (${modelName})` : ''}`)}`
          : ''}
        {threadName
          ? `${themed('border', ' · ')}${themed('muted', `"${threadName}"`)}`
          : ''}{' '}
        {themed(ConnectionColors[connection], '●')}
        {themed('border', ' ──')}
      </Text>
    </Box>
  )
}
