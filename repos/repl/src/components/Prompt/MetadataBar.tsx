import type { TConnectionStatus } from '@TRL/types'

import { Box, Text } from 'ink'
import { themed } from '@TRL/theme'

type TMetadataBar = {
  orgName?: string
  agentName?: string
  threadName?: string
  projectName?: string
  connection: TConnectionStatus
}

export const MetadataBar = (props: TMetadataBar) => {
  const { orgName, agentName, threadName, projectName, connection } = props

  const dot = connection === `connected` ? themed(`success`, `●`) : themed(`error`, `○`)

  const status = connection === `connected` ? `connected` : `disconnected`

  const parts: string[] = []
  if (orgName) parts.push(`org: ${orgName}`)
  if (projectName) parts.push(`project: ${projectName}`)
  if (agentName) parts.push(`agent: ${agentName}`)
  parts.push(`thread: ${threadName || `new`}`)

  return (
    <Box paddingX={1}>
      <Text>
        {themed(`muted`, parts.join(` │ `))}
        {themed(`muted`, ` │ `)}
        {dot}
        {themed(`muted`, ` ${status}`)}
      </Text>
    </Box>
  )
}
