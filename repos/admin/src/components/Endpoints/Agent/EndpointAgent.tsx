import type { TEndpointFormProps } from '@TAF/types/endpoints.types'
import type { TAgentEndpointConfig } from '@tdsk/domain'

import { useMemo } from 'react'
import { vep } from '@TAF/utils/endpoints/validators'
import { useAgentFormState } from '@TAF/hooks/endpoints'
import { mapAgentStateToConfig } from '@TAF/utils/endpoints'
import { AgentInputs } from '@TAF/components/Endpoints/Agent/AgentInputs'
import { useEndpointForm } from '@TAF/hooks/endpoints/useEndpointForm'
import { setAgentEnvVars, setAgentFormField } from '@TAF/actions/endpoints/local'

export const EndpointAgent = (props: TEndpointFormProps<TAgentEndpointConfig>) => {
  const {
    loading,
    endpoint,
    onValidate,
    onConfigChange,
    availableSecrets,
    availableAgents = [],
    availableProviders = [],
    availableFunctions = [],
  } = props

  const state = useAgentFormState(endpoint)

  useEndpointForm(state, mapAgentStateToConfig, vep.agent, onConfigChange, onValidate)

  const agents = useMemo(
    () => availableAgents.map((a) => ({ id: a.id, name: a.name })),
    [availableAgents]
  )

  const aiProviders = useMemo(
    () =>
      availableProviders
        .filter((p) => p.type === `ai`)
        .map((p) => ({ id: p.id, name: p.name || p.id })),
    [availableProviders]
  )

  return (
    <AgentInputs
      agents={agents}
      loading={loading}
      model={state.model}
      tools={state.tools}
      secrets={state.secrets}
      envVars={state.envVars}
      agentId={state.agentId}
      providers={aiProviders}
      maxTokens={state.maxTokens}
      functionIds={state.functionIds}
      providerIds={state.providerIds}
      systemPrompt={state.systemPrompt}
      availableSecrets={availableSecrets}
      availableFunctions={availableFunctions}
      onEnvVarsChange={(envVars) => setAgentEnvVars(envVars)}
      onModelChange={(value) => setAgentFormField(`model`, value)}
      onToolsChange={(tools) => setAgentFormField(`tools`, tools)}
      onAgentIdChange={(value) => setAgentFormField(`agentId`, value)}
      onMaxTokensChange={(value) => setAgentFormField(`maxTokens`, value)}
      onSecretsChange={(secrets) => setAgentFormField(`secrets`, secrets)}
      onFunctionIdsChange={(ids) => setAgentFormField(`functionIds`, ids)}
      onProviderIdsChange={(ids) => setAgentFormField(`providerIds`, ids)}
      onSystemPromptChange={(value) => setAgentFormField(`systemPrompt`, value)}
    />
  )
}
