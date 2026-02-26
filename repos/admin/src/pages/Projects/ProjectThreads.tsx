import { ERoutePath } from '@TAF/types'
import { useParams, useNavigate } from 'react-router'
import { buildNavRoute } from '@TAF/utils/nav/buildRoute'
import { ThreadsTab } from '@TAF/components/AI/ThreadsTab'
import { useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'

export type TProjectThreads = {}

export const ProjectThreads = (props: TProjectThreads) => {
  const { agentId } = useParams<{ agentId: string }>()
  const navigate = useNavigate()
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()

  const onViewThread = (threadId: string) => {
    navigate(
      buildNavRoute(
        { orgId, projectId, agentId, threadId },
        ERoutePath.ProjectAgentThreadDetail
      )
    )
  }

  const onChatWithThread = (threadId: string, threadAgentId: string) => {
    navigate(
      buildNavRoute(
        { orgId, projectId, agentId, threadId },
        ERoutePath.ProjectAgentThreadChat
      )
    )
  }

  if (!orgId || !projectId) return null

  return (
    <ThreadsTab
      onViewThread={onViewThread}
      onChatWithThread={onChatWithThread}
    />
  )
}

export default ProjectThreads
