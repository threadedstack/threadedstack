import type { TTimelineEntry } from '@TAF/types/agentActivity.types'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { useState } from 'react'
import { Text } from '@tdsk/components'

/** The writer tail-caps transcript input/output at 20k chars, so a body at
 * exactly that length is almost certainly truncated and must say so. */
const TranscriptCap = 20_000

export type TAgentTimeline = {
  entries: TTimelineEntry[]
  loading: boolean
}

/**
 * The merged activity feed. `loading` distinguishes "not fetched yet" from
 * "fetched and genuinely empty" — collapsing them would make a brand-new agent
 * look permanently stuck loading.
 */
export const AgentTimeline = (props: TAgentTimeline) => {
  const { entries, loading } = props
  const [openId, setOpenId] = useState<string>()

  if (loading) return <Box data-testid='agent-timeline-skeleton'>Loading…</Box>
  if (!entries.length) return <Text>No activity yet for this agent.</Text>

  return (
    <Box display='flex' flexDirection='column' gap={1}>
      {entries.map((entry) => (
        <Box
          key={entry.id}
          data-testid={`timeline-entry-${entry.id}`}
          onClick={() => setOpenId(openId === entry.id ? undefined : entry.id)}
          sx={{ cursor: `pointer`, p: 1, borderBottom: `1px solid`, borderColor: `divider` }}
        >
          <Box display='flex' gap={1} alignItems='center'>
            <Chip size='small' variant='outlined' label={entry.kind} />
            <Text>{entry.title}</Text>
            <Text>{entry.at}</Text>
          </Box>
          {openId === entry.id && entry.body && (
            <Box mt={1}>
              <Text>{entry.body}</Text>
              {entry.body.length >= TranscriptCap && (
                <Text>(truncated by the transcript writer)</Text>
              )}
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}
