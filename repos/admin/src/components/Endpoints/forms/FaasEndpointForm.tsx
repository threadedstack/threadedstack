import type { TEndpointFormProps } from '@TAF/types/endpoints.types'
import type { TFaaSEndpointConfig } from '@tdsk/domain'

import { vep } from '@TAF/utils/endpoints/validators'
import { useFaasFormState } from '@TAF/hooks/endpoints'
import { mapFaasStateToConfig } from '@TAF/utils/endpoints'
import { EndpointFaas } from '@TAF/components/Endpoints/EndpointFaas'
import { useEndpointForm } from '@TAF/hooks/endpoints/useEndpointForm'
import {
  setFaasEnvVars,
  setFaasArguments,
  setFaasFormField,
} from '@TAF/actions/endpoints/local'

export const FaasEndpointForm = (props: TEndpointFormProps<TFaaSEndpointConfig>) => {
  const {
    loading,
    endpoint,
    onValidate,
    onConfigChange,
    availableSecrets,
    availableFunctions = [],
  } = props

  const state = useFaasFormState(endpoint)

  useEndpointForm(state, mapFaasStateToConfig, vep.faas, onConfigChange, onValidate)

  return (
    <EndpointFaas
      loading={loading}
      memory={state.memory}
      timeout={state.timeout}
      secrets={state.secrets}
      envVars={state.envVars}
      arguments={state.arguments}
      functionId={state.functionId}
      availableSecrets={availableSecrets}
      availableFunctions={availableFunctions}
      onArgumentsChange={(args) => setFaasArguments(args)}
      onEnvVarsChange={(envVars) => setFaasEnvVars(envVars)}
      onMemoryChange={(value) => setFaasFormField(`memory`, value)}
      onTimeoutChange={(value) => setFaasFormField(`timeout`, value)}
      onFunctionIdChange={(value) => setFaasFormField(`functionId`, value)}
      onSecretsChange={(secrets) => setFaasFormField(`secrets`, secrets)}
    />
  )
}
