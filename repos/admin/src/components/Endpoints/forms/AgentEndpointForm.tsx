import type { TEndpointFormProps } from '@TAF/types/endpoints.types'
import type { TAgentEndpointConfig } from '@tdsk/domain'

import { vep } from '@TAF/utils/endpoints/validators'
import { useAgentFormState } from '@TAF/hooks/endpoints'
import { mapAgentStateToConfig } from '@TAF/utils/endpoints'
import { useEndpointForm } from '@TAF/hooks/endpoints/useEndpointForm'
import { EndpointAgent } from '@TAF/components/Endpoints/EndpointAgent'
import { setAgentEnvVars, setAgentFormField } from '@TAF/actions/endpoints/local'

export const AgentEndpointForm = (props: TEndpointFormProps<TAgentEndpointConfig>) => {
  const { loading, endpoint, onValidate, onConfigChange, availableSecrets } = props

  const state = useAgentFormState(endpoint)

  useEndpointForm(state, mapAgentStateToConfig, vep.agent, onConfigChange, onValidate)

  return (
    <EndpointAgent
      loading={loading}
      model={state.model}
      tools={state.tools}
      secrets={state.secrets}
      envVars={state.envVars}
      agentId={state.agentId}
      maxTokens={state.maxTokens}
      systemPrompt={state.systemPrompt}
      availableSecrets={availableSecrets}
      onEnvVarsChange={(envVars) => setAgentEnvVars(envVars)}
      onModelChange={(value) => setAgentFormField(`model`, value)}
      onToolsChange={(tools) => setAgentFormField(`tools`, tools)}
      onAgentIdChange={(value) => setAgentFormField(`agentId`, value)}
      onMaxTokensChange={(value) => setAgentFormField(`maxTokens`, value)}
      onSecretsChange={(secrets) => setAgentFormField(`secrets`, secrets)}
      onSystemPromptChange={(value) => setAgentFormField(`systemPrompt`, value)}
    />
  )
}
