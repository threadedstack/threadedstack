import Box from '@mui/material/Box'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { toTimeline } from '@TAF/utils/agentActivity/toTimeline'
import { AgentTimeline } from '@TAF/components/AgentActivity/AgentTimeline'
import { AgentCollections } from '@TAF/components/AgentActivity/AgentCollections'
import { AgentStatusHeader } from '@TAF/components/AgentActivity/AgentStatusHeader'
import {
  useCollections,
  useAgentTurnsMap,
  useAgentStatusMap,
  useAgentMemoriesMap,
  useAgentMessagesMap,
  useCollectionRecordsMap,
} from '@TAF/state/selectors'

const withCount = (label: string, count?: number) =>
  count === undefined ? label : `${label} · ${count}`

/**
 * The agent observability view, rendered inside `AgentLayout` as its "Activity"
 * tab so it inherits the agent header, breadcrumbs, and chrome. A live status
 * bar sits over two sub-views — Feed (what it just did) and Collections (a
 * browser over every data collection the project owns, and the raw records
 * inside each).
 *
 * It only READS atoms; the route loader owns every fetch and the poll, so there
 * is no data loading here and no accessor is called. The Collections browser
 * fetches a collection's records on click, through an action.
 */
export const AgentActivity = () => {
  const { orgId, projectId, agentId } = useParams()
  const [tab, setTab] = useState(0)

  const [statusMap] = useAgentStatusMap()
  const [turnsMap] = useAgentTurnsMap()
  const [messagesMap] = useAgentMessagesMap()
  const [memoriesMap] = useAgentMemoriesMap()
  const [collectionsMap] = useCollections()
  const [recordsMap] = useCollectionRecordsMap()

  const turns = agentId ? turnsMap?.[agentId] : undefined
  const messages = agentId ? messagesMap?.[agentId] : undefined
  const memories = agentId ? memoriesMap?.[agentId] : undefined
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
      {tab === 1 && (
        // Key on projectId so the browser's selected-collection state resets when
        // the project changes (collections are project-scoped); the router re-runs
        // the loader on a param change without remounting this subtree.
        <AgentCollections
          key={projectId || `none`}
          collections={collections}
          recordsMap={recordsMap}
          orgId={orgId || ``}
          projectId={projectId || ``}
        />
      )}
    </Box>
  )
}

export default AgentActivity
