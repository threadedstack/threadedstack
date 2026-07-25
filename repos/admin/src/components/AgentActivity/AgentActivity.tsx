import Box from '@mui/material/Box'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { toTimeline } from '@TAF/utils/agentActivity/toTimeline'
import { AgentRoadmap } from '@TAF/components/AgentActivity/AgentRoadmap'
import { AgentTimeline } from '@TAF/components/AgentActivity/AgentTimeline'
import { AgentCollections } from '@TAF/components/AgentActivity/AgentCollections'
import { AgentStatusHeader } from '@TAF/components/AgentActivity/AgentStatusHeader'
import {
  useCollections,
  useAgentTurnsMap,
  useAgentPlansMap,
  useAgentStatusMap,
  useAgentMemoriesMap,
  useAgentMessagesMap,
} from '@TAF/state/selectors'

const withCount = (label: string, count?: number) =>
  count === undefined ? label : `${label} · ${count}`

/**
 * The agent observability view, rendered inside `AgentLayout` as its "Activity"
 * tab so it inherits the agent header, breadcrumbs, and chrome. A live status
 * bar sits over three sub-views — Feed (what it just did), Roadmap (what it is
 * working toward), and Collections (the data it operates on).
 *
 * It only READS atoms; the route loader owns every fetch and the poll, so there
 * is no data loading here and no accessor is called.
 */
export const AgentActivity = () => {
  const { orgId, projectId, agentId } = useParams()
  const [tab, setTab] = useState(0)

  const [statusMap] = useAgentStatusMap()
  const [turnsMap] = useAgentTurnsMap()
  const [messagesMap] = useAgentMessagesMap()
  const [memoriesMap] = useAgentMemoriesMap()
  const [plansMap] = useAgentPlansMap()
  const [collectionsMap] = useCollections()

  const turns = agentId ? turnsMap?.[agentId] : undefined
  const messages = agentId ? messagesMap?.[agentId] : undefined
  const memories = agentId ? memoriesMap?.[agentId] : undefined
  const plans = agentId ? plansMap?.[agentId] : undefined
  const collections = projectId ? collectionsMap?.[projectId] : undefined

  // `undefined` on every source means nothing has been fetched yet. Once any
  // source has resolved, an empty feed is a real empty state.
  const loading = turns === undefined && messages === undefined && memories === undefined

  const entries = useMemo(
    () => toTimeline({ turns, messages, memories }),
    [turns, messages, memories]
  )

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2, minWidth: 0, width: `100%` }}>
      <AgentStatusHeader status={agentId ? statusMap?.[agentId] : undefined} />

      <Box sx={{ borderBottom: 1, borderColor: `divider` }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
        >
          <Tab label={withCount(`Feed`, loading ? undefined : entries.length)} />
          <Tab label={withCount(`Roadmap`, plans?.length)} />
          <Tab
            label={withCount(
              `Collections`,
              collections ? Object.keys(collections).length : undefined
            )}
          />
        </Tabs>
      </Box>

      {tab === 0 && (
        <AgentTimeline
          entries={entries}
          loading={loading}
        />
      )}
      {tab === 1 && <AgentRoadmap plans={plans} />}
      {tab === 2 && (
        <AgentCollections
          collections={collections}
          orgId={orgId || ``}
          projectId={projectId || ``}
        />
      )}
    </Box>
  )
}

export default AgentActivity
