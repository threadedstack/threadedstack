import { useMemo } from 'react'
import { useParams } from 'react-router'
import { toTimeline } from '@TAF/utils/agentActivity/toTimeline'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { AgentTimeline } from '@TAF/components/AgentActivity/AgentTimeline'
import { AgentStatusHeader } from '@TAF/components/AgentActivity/AgentStatusHeader'
import {
  useAgentTurnsMap,
  useAgentStatusMap,
  useAgentMemoriesMap,
  useAgentMessagesMap,
} from '@TAF/state/selectors'

/**
 * The agent activity page. It only READS atoms — the route loader owns the
 * initial fetch and starts the poll, so there is no data loading in this
 * component and no accessor is called from it.
 */
export const AgentActivity = () => {
  const { agentId } = useParams()

  const [statusMap] = useAgentStatusMap()
  const [turnsMap] = useAgentTurnsMap()
  const [messagesMap] = useAgentMessagesMap()
  const [memoriesMap] = useAgentMemoriesMap()

  const turns = agentId ? turnsMap?.[agentId] : undefined
  const messages = agentId ? messagesMap?.[agentId] : undefined
  const memories = agentId ? memoriesMap?.[agentId] : undefined

  // `undefined` on every source means nothing has been fetched yet. Once any
  // source has resolved, an empty feed is a real empty state.
  const loading = turns === undefined && messages === undefined && memories === undefined

  const entries = useMemo(
    () => toTimeline({ turns, messages, memories }),
    [turns, messages, memories]
  )

  return (
    <PageLayout title='Agent Activity' count={loading ? undefined : entries.length}>
      <AgentStatusHeader status={agentId ? statusMap?.[agentId] : undefined} />
      <AgentTimeline entries={entries} loading={loading} />
    </PageLayout>
  )
}

export default AgentActivity
