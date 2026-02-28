import type { TEndpointFormProps } from '@TAF/types/endpoints.types'
import type { TProxyEndpointConfig } from '@tdsk/domain'

import { vep } from '@TAF/utils/endpoints/validators'
import { useProxyFormState } from '@TAF/hooks/endpoints'
import { mapProxyStateToConfig } from '@TAF/utils/endpoints'
import { useEndpointForm } from '@TAF/hooks/endpoints/useEndpointForm'
import { ProxyInputs } from '@TAF/components/Endpoints/Proxy/ProxyInputs'
import {
  setProxyHeaders,
  setProxyFormField,
  setProxyOAuthParams,
} from '@TAF/actions/endpoints/local'

export const EndpointProxy = (props: TEndpointFormProps<TProxyEndpointConfig>) => {
  const { loading, endpoint, onValidate, onConfigChange, availableSecrets } = props

  const state = useProxyFormState(endpoint)

  useEndpointForm(state, mapProxyStateToConfig, vep.proxy, onConfigChange, onValidate)

  return (
    <ProxyInputs
      // Basic fields
      loading={loading}
      url={state.url}
      proxyMethod={state.proxyMethod}
      onUrlChange={(value) => setProxyFormField(`url`, value)}
      onProxyMethodChange={(value) => setProxyFormField(`proxyMethod`, value)}
      // Headers
      headers={state.headers}
      onHeadersChange={(headers) => setProxyHeaders(headers)}
      // Basic options
      timeout={state.timeout}
      retries={state.retries}
      pathRegex={state.pathRegex}
      onTimeoutChange={(value) => setProxyFormField(`timeout`, value)}
      onRetriesChange={(value) => setProxyFormField(`retries`, value)}
      onPathRegexChange={(value) => setProxyFormField(`pathRegex`, value)}
      // Retry configuration
      retryDelay={state.retryDelay}
      retryMaxDelay={state.retryMaxDelay}
      retryBackoffMultiplier={state.retryBackoffMultiplier}
      retryExponentialBackoff={state.retryExponentialBackoff}
      onRetryDelayChange={(value) => setProxyFormField(`retryDelay`, value)}
      onRetryMaxDelayChange={(value) => setProxyFormField(`retryMaxDelay`, value)}
      onRetryBackoffMultiplierChange={(value) =>
        setProxyFormField(`retryBackoffMultiplier`, value)
      }
      onRetryExponentialBackoffChange={(value) =>
        setProxyFormField(`retryExponentialBackoff`, value)
      }
      // Auth
      authType={state.authType}
      authEnabled={state.authEnabled}
      availableSecrets={availableSecrets}
      authSecretName={state.authSecretName}
      authHeaderName={state.authHeaderName}
      onAuthEnabledChange={(value) => setProxyFormField(`authEnabled`, value)}
      onAuthTypeChange={(value) => setProxyFormField(`authType`, value)}
      onAuthSecretNameChange={(value) => setProxyFormField(`authSecretName`, value)}
      onAuthHeaderNameChange={(value) => setProxyFormField(`authHeaderName`, value)}
      // OAuth
      oauthScopes={state.oauthScopes}
      oauthParams={state.oauthParams}
      oauthEnabled={state.oauthEnabled}
      oauthTokenUrl={state.oauthTokenUrl}
      oauthClientId={state.oauthClientId}
      oauthClientSecret={state.oauthClientSecret}
      oauthCredentialType={state.oauthCredentialType}
      onOauthParamsChange={(params) => setProxyOAuthParams(params)}
      onOauthScopesChange={(value) => setProxyFormField(`oauthScopes`, value)}
      onOauthEnabledChange={(value) => setProxyFormField(`oauthEnabled`, value)}
      onOauthTokenUrlChange={(value) => setProxyFormField(`oauthTokenUrl`, value)}
      onOauthClientIdChange={(value) => setProxyFormField(`oauthClientId`, value)}
      onOauthClientSecretChange={(value) => setProxyFormField(`oauthClientSecret`, value)}
      onOauthCredentialStyleChange={(value) =>
        setProxyFormField(`oauthCredentialType`, value)
      }
      // Transform
      transformEnabled={state.transformEnabled}
      transformInjectSecrets={state.transformInjectSecrets}
      onTransformEnabledChange={(value) => setProxyFormField(`transformEnabled`, value)}
      onTransformInjectSecretsChange={(value) =>
        setProxyFormField(`transformInjectSecrets`, value)
      }
      // Whitelist
      whitelistEnabled={state.whitelistEnabled}
      whitelistDomains={state.whitelistDomains}
      whitelistEnforce={state.whitelistEnforce}
      whitelistLogBlocked={state.whitelistLogBlocked}
      onWhitelistEnabledChange={(value) => setProxyFormField(`whitelistEnabled`, value)}
      onWhitelistDomainsChange={(value) => setProxyFormField(`whitelistDomains`, value)}
      onWhitelistEnforceChange={(value) => setProxyFormField(`whitelistEnforce`, value)}
      onWhitelistLogBlockedChange={(value) =>
        setProxyFormField(`whitelistLogBlocked`, value)
      }
    />
  )
}
