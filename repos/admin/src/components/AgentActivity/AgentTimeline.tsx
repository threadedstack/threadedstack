import type { TTimelineEntry } from '@TAF/types/agentActivity.types'

import Box from '@mui/material/Box'
import { useState } from 'react'
import Skeleton from '@mui/material/Skeleton'
import { Text } from '@tdsk/components'
import { AgentTimelineEntry } from '@TAF/components/AgentActivity/AgentTimelineEntry'

export type TAgentTimeline = {
  entries: TTimelineEntry[]
  loading: boolean
}

const SkeletonRow = () => (
  <Box sx={{ display: `flex`, gap: 1.5, px: 1, py: 1.25 }}>
    <Skeleton
      variant='circular'
      width={12}
      height={12}
      sx={{ mt: 0.5, ml: 0.5 }}
    />
    <Box sx={{ flex: 1 }}>
      <Skeleton width='40%' height={18} />
      <Skeleton width='75%' height={14} />
    </Box>
  </Box>
)

/**
 * The merged activity feed. `loading` distinguishes "not fetched yet" from
 * "fetched and genuinely empty" — collapsing them would make a brand-new agent
 * look permanently stuck loading. Entries expand independently so several turns
 * can be read side by side.
 */
export const AgentTimeline = (props: TAgentTimeline) => {
  const { entries, loading } = props
  const [open, setOpen] = useState<Set<string>>(() => new Set())

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  if (loading)
    return (
      <Box data-testid='agent-timeline-skeleton'>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </Box>
    )

  if (!entries.length)
    return (
      <Box
        sx={{
          py: 8,
          textAlign: `center`,
          borderRadius: 2,
          border: `1px dashed`,
          borderColor: `divider`,
        }}
      >
        <Text sx={{ fontSize: 15, fontWeight: 600 }}>No activity yet</Text>
        <Text sx={{ mt: 0.5, fontSize: 13, color: `text.secondary` }}>
          This agent has not recorded any turns, messages, or memories.
        </Text>
      </Box>
    )

  return (
    <Box sx={{ width: `100%`, minWidth: 0 }}>
      {entries.map((entry) => (
        <AgentTimelineEntry
          key={entry.id}
          entry={entry}
          expanded={open.has(entry.id)}
          onToggle={() => toggle(entry.id)}
        />
      ))}
    </Box>
  )
}
