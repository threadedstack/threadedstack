import { ERoutePath } from '@TAF/types'
import { Box, Typography } from '@mui/material'
import { styled } from '@mui/material/styles'
import { ChevronRight } from '@mui/icons-material'
import { buildNavRoute } from '@TAF/utils/nav/buildRoute'
import { Link, useParams, useLocation } from 'react-router'
import { useActiveAgent, useActiveThread } from '@TAF/state/selectors'

const SeparatorIcon = styled(ChevronRight)(({ theme }) => {
  return `
    font-size: 18px;
    margin-left: ${theme.gutter.qpx};
    margin-right: ${theme.gutter.qpx};
    color: ${theme.palette.text.disabled};
  `
})

const BreadcrumbLink = styled(Link)(({ theme }) => ({
  color: theme.palette.text.secondary,
  textDecoration: `none`,
  fontSize: `0.875rem`,
  [`&:hover`]: {
    color: theme.palette.primary.main,
    textDecoration: `underline`,
  },
}))

const BreadcrumbText = styled(Typography)({
  fontSize: `0.875rem`,
  fontWeight: 500,
}) as typeof Typography

export const AgentBreadcrumbs = () => {
  const { orgId, projectId, agentId, threadId } = useParams<{
    orgId: string
    projectId: string
    agentId: string
    threadId: string
  }>()
  const location = useLocation()
  const [agent] = useActiveAgent()
  const [thread] = useActiveThread()

  const basePath = buildNavRoute({ orgId, projectId }, ERoutePath.OrgProject)
  const agentPath = `${basePath}/agents/${agentId}`
  const threadsPath = `${agentPath}/threads`
  const isChat = location.pathname.endsWith(`/chat`)
  const isNewChat = isChat && !threadId

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
      <BreadcrumbLink to={`${basePath}/agents`}>Agents</BreadcrumbLink>

      <SeparatorIcon />
      {threadId || isChat ? (
        <BreadcrumbLink to={agentPath}>{agent?.name || 'Agent'}</BreadcrumbLink>
      ) : (
        <BreadcrumbText color='text.primary'>{agent?.name || 'Agent'}</BreadcrumbText>
      )}

      {(threadId || location.pathname.includes('/threads')) && !isNewChat && (
        <>
          <SeparatorIcon />
          {threadId ? (
            <BreadcrumbLink to={threadsPath}>Threads</BreadcrumbLink>
          ) : (
            <BreadcrumbText color='text.primary'>Threads</BreadcrumbText>
          )}
        </>
      )}

      {isNewChat && (
        <>
          <SeparatorIcon />
          <BreadcrumbText color='text.primary'>New Chat</BreadcrumbText>
        </>
      )}

      {threadId && (
        <>
          <SeparatorIcon />
          {isChat ? (
            <BreadcrumbLink to={`${threadsPath}/${threadId}`}>
              {thread?.name || 'Thread'}
            </BreadcrumbLink>
          ) : (
            <BreadcrumbText color='text.primary'>
              {thread?.name || 'Thread'}
            </BreadcrumbText>
          )}
        </>
      )}

      {threadId && isChat && (
        <>
          <SeparatorIcon />
          <BreadcrumbText color='text.primary'>Chat</BreadcrumbText>
        </>
      )}
    </Box>
  )
}
