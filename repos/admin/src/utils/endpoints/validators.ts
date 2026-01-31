import type {
  TProxyFormState,
  TFaasFormState,
  TAgentFormState,
} from '@TAF/types/endpoints.types'

class ValidateEndpoint {
  proxy = (state: TProxyFormState): string | null => {
    if (!state.url?.trim()) return `Proxy URL is required for proxy endpoints`

    if (state.authEnabled && !state.authSecretName?.trim())
      return `Auth secret name is required when authentication is enabled`

    if (state.oauthEnabled) {
      if (!state.oauthTokenUrl?.trim())
        return `OAuth token URL is required when OAuth is enabled`
      if (!state.oauthClientId?.trim())
        return `OAuth client ID is required when OAuth is enabled`
      if (!state.oauthClientSecret?.trim())
        return `OAuth client secret is required when OAuth is enabled`
    }

    return null
  }

  faas = (state: TFaasFormState): string | null => {
    if (!state.functionId?.trim()) return `Please select a function for FAAS endpoints`
    return null
  }

  agent = (state: TAgentFormState): string | null => {
    if (!state.agentId?.trim()) return `Please select an agent for agent endpoints`
    return null
  }

  shared = (name: string, path: string): string | null => {
    if (!name?.trim()) return `Endpoint name is required`
    if (!path?.trim()) return `Endpoint path is required`
    if (!path.startsWith(`/`)) return `Endpoint path must start with /`
    return null
  }
}

export const vep = new ValidateEndpoint()
