import { nav } from '@TAF/services/nav'
import { AgentSection } from '@TAF/components/Agents/AgentSection'
import { useActiveOrgId, useActiveAgent } from '@TAF/state/selectors'
import { Box, Chip, Stack, Typography } from '@mui/material'

export const AgentDetailTab = () => {
  const [orgId] = useActiveOrgId()
  const [agent] = useActiveAgent()

  if (!agent) return null

  const envVarKeys = Object.keys(agent.envVars || {})

  return (
    <>
      <AgentSection
        title='Agent Information'
        description={agent.description}
      >
        <Box sx={{ mb: 2 }}>
          <Typography
            variant='subtitle2'
            color='text.secondary'
          >
            Agent ID
          </Typography>
          <Typography
            variant='body2'
            fontFamily='monospace'
          >
            {agent.id}
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography
            variant='subtitle2'
            color='text.secondary'
          >
            Org ID
          </Typography>
          <Typography
            variant='body2'
            fontFamily='monospace'
          >
            {agent.orgId}
          </Typography>
        </Box>

        {agent.createdAt && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Created At
            </Typography>
            <Typography variant='body2'>
              {new Date(agent.createdAt).toLocaleString()}
            </Typography>
          </Box>
        )}

        {agent.updatedAt && (
          <Box>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Last Updated
            </Typography>
            <Typography variant='body2'>
              {new Date(agent.updatedAt).toLocaleString()}
            </Typography>
          </Box>
        )}
      </AgentSection>

      <AgentSection title='LLM Configuration'>
        {agent.primaryProvider && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Provider
            </Typography>
            <Typography variant='body1'>{agent.primaryProvider.name}</Typography>
          </Box>
        )}

        {agent.model && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Model
            </Typography>
            <Typography variant='body1'>{agent.model}</Typography>
          </Box>
        )}

        {agent.maxTokens != null && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Max Tokens
            </Typography>
            <Typography variant='body1'>{agent.maxTokens.toLocaleString()}</Typography>
          </Box>
        )}

        <Box sx={{ mb: 2 }}>
          <Typography
            variant='subtitle2'
            color='text.secondary'
          >
            Temperature
          </Typography>
          <Typography variant='body1'>
            {agent.environment?.temperature ?? 'Default'}
          </Typography>
        </Box>

        <Box>
          <Typography
            variant='subtitle2'
            color='text.secondary'
          >
            Streaming
          </Typography>
          <Chip
            size='small'
            sx={{ mt: 0.5 }}
            label={agent.environment?.streaming ? 'Enabled' : 'Disabled'}
            color={agent.environment?.streaming ? 'success' : 'default'}
          />
        </Box>
      </AgentSection>

      {agent.systemPrompt && (
        <AgentSection title='System Prompt'>
          <Box
            component='pre'
            sx={{
              p: 2,
              borderRadius: 1,
              overflow: 'auto',
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              bgcolor: 'background.default',
            }}
          >
            {agent.systemPrompt}
          </Box>
        </AgentSection>
      )}

      <AgentSection
        title={`Tools${agent.tools?.length ? ` (${agent.tools.length})` : ''}`}
      >
        {agent.tools && agent.tools.length > 0 ? (
          <Stack
            useFlexGap
            spacing={1}
            flexWrap='wrap'
            direction='row'
          >
            {agent.tools.map((tool) => {
              return (
                (tool && (
                  <Chip
                    key={tool}
                    size='small'
                    label={tool}
                    variant='outlined'
                  />
                )) ||
                null
              )
            })}
          </Stack>
        ) : (
          <Typography color='text.secondary'>No tools configured</Typography>
        )}
      </AgentSection>

      <AgentSection
        title={`Secrets${agent.secrets?.length ? ` (${agent.secrets.length})` : ''}`}
      >
        {agent.secrets && agent.secrets.length > 0 ? (
          <Stack
            useFlexGap
            spacing={1}
            direction='row'
            flexWrap='wrap'
          >
            {agent.secrets.map((secret) => {
              return (
                (secret?.id && (
                  <Chip
                    size='small'
                    color='primary'
                    key={secret.id}
                    variant='outlined'
                    label={secret.name || secret.hashKey}
                  />
                )) ||
                null
              )
            })}
          </Stack>
        ) : (
          <Typography color='text.secondary'>No secrets configured</Typography>
        )}
      </AgentSection>

      {envVarKeys.length > 0 && (
        <AgentSection title={`Environment Variables (${envVarKeys.length})`}>
          {envVarKeys.map((key) => (
            <Box
              key={key}
              sx={{ mb: 1.5 }}
            >
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                {key}
              </Typography>
              <Typography
                variant='body2'
                fontFamily='monospace'
              >
                {agent.envVars[key]}
              </Typography>
            </Box>
          ))}
        </AgentSection>
      )}

      {agent.projects && agent.projects.length > 0 && (
        <AgentSection title={`Linked Projects (${agent.projects.length})`}>
          <Stack
            useFlexGap
            spacing={1}
            flexWrap='wrap'
            direction='row'
          >
            {agent.projects.map((project) => {
              return (
                (project?.id && (
                  <Chip
                    clickable
                    size='small'
                    key={project.id}
                    variant='outlined'
                    label={project.name}
                    onClick={() => nav.to(`/orgs/${orgId}/projects/${project.id}`)}
                  />
                )) ||
                null
              )
            })}
          </Stack>
        </AgentSection>
      )}
    </>
  )
}

export default AgentDetailTab
