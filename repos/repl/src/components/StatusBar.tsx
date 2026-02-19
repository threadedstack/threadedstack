import React from 'react'
import { Box, Text } from 'ink'
import { themed } from '@TRL/theme'
import type { TThemeColors } from '@TRL/theme/themes'
import type { TConnectionStatus } from '@TRL/types'

type StatusBarProps = {
  agentName: string
  providerName?: string
  modelName?: string
  threadName?: string
  connection: TConnectionStatus
}

const CONNECTION_COLORS: Record<TConnectionStatus, keyof TThemeColors> = {
  connected: 'success',
  disconnected: 'error',
  reconnecting: 'warning',
}

export function StatusBar({
  agentName,
  providerName,
  modelName,
  threadName,
  connection,
}: StatusBarProps) {
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
        {themed(CONNECTION_COLORS[connection], '●')}
        {themed('border', ' ──')}
      </Text>
    </Box>
  )
}
