import type { TKeyValuePair } from '@TAF/types'
import type { Secret } from '@tdsk/domain'

import { EndpointAuth } from './proxy/EndpointAuth'
import { EndpointOAuth } from './proxy/EndpointOAuth'
import { HttpMethodOps } from '@TAF/constants/values'
import { EndpointHeaders } from './proxy/EndpointHeaders'
import { TextInput, SelectInput } from '@tdsk/components'
import { EndpointTransform } from './proxy/EndpointTransform'
import { EndpointWhitelist } from './proxy/EndpointWhitelist'
import { EndpointBasicOptions } from './proxy/EndpointBasicOptions'

export type TEndpointProxy = {
  loading: boolean
  // Basic fields
  url: string
  method: string
  onUrlChange: (value: string) => void
  onMethodChange: (value: string) => void

  // Headers
  headers: TKeyValuePair[]
  onHeadersChange: (pairs: TKeyValuePair[]) => void

  // Basic options
  timeout: string
  retries: string
  pathRegex: string
  onTimeoutChange: (value: string) => void
  onRetriesChange: (value: string) => void
  onPathRegexChange: (value: string) => void

  // Retry configuration
  retryDelay: string
  retryMaxDelay: string
  retryBackoffMultiplier: string
  retryExponentialBackoff: boolean
  onRetryDelayChange: (value: string) => void
  onRetryMaxDelayChange: (value: string) => void
  onRetryBackoffMultiplierChange: (value: string) => void
  onRetryExponentialBackoffChange: (value: boolean) => void

  // Auth
  authEnabled: boolean
  authType: `bearer` | `basic` | `apikey`
  authSecretName: string
  authHeaderName: string
  onAuthEnabledChange: (value: boolean) => void
  onAuthTypeChange: (value: `bearer` | `basic` | `apikey`) => void
  onAuthSecretNameChange: (value: string) => void
  onAuthHeaderNameChange: (value: string) => void

  // OAuth
  oauthEnabled: boolean
  oauthTokenUrl: string
  oauthClientId: string
  oauthClientSecret: string
  oauthScopes: string
  oauthCredentialStyle: `header` | `body`
  oauthParams: TKeyValuePair[]
  onOauthEnabledChange: (value: boolean) => void
  onOauthTokenUrlChange: (value: string) => void
  onOauthClientIdChange: (value: string) => void
  onOauthClientSecretChange: (value: string) => void
  onOauthScopesChange: (value: string) => void
  onOauthCredentialStyleChange: (value: `header` | `body`) => void
  onOauthParamsChange: (pairs: TKeyValuePair[]) => void

  // Transform
  transformEnabled: boolean
  transformInjectSecrets: boolean
  onTransformEnabledChange: (value: boolean) => void
  onTransformInjectSecretsChange: (value: boolean) => void

  // Domain whitelist
  whitelistEnabled: boolean
  whitelistDomains: string
  whitelistEnforce: boolean
  whitelistLogBlocked: boolean
  onWhitelistEnabledChange: (value: boolean) => void
  onWhitelistDomainsChange: (value: string) => void
  onWhitelistEnforceChange: (value: boolean) => void
  onWhitelistLogBlockedChange: (value: boolean) => void

  // Available secrets
  availableSecrets: Secret[]
}

export const EndpointProxy = (props: TEndpointProxy) => {
  const { loading, availableSecrets } = props

  return (
    <>
      {/* Proxy URL and Method */}
      <TextInput
        required
        fullWidth
        value={props.url}
        id='endpoint-url'
        label='Proxy URL'
        disabled={loading}
        onChange={(e) => props.onUrlChange(e.target.value)}
        placeholder='https://api.example.com/v1/users'
      />

      <SelectInput
        required
        id='method-select'
        disabled={loading}
        label='HTTP Method'
        items={HttpMethodOps}
        value={props.method.toLowerCase()}
        onChange={(e) => props.onMethodChange(e.target.value)}
      />

      {/* Headers */}
      <EndpointHeaders
        loading={loading}
        headers={props.headers}
        onChange={props.onHeadersChange}
        availableSecrets={availableSecrets}
      />

      {/* Basic Options */}
      <EndpointBasicOptions
        loading={loading}
        timeout={props.timeout}
        retries={props.retries}
        pathRegex={props.pathRegex}
        retryDelay={props.retryDelay}
        retryMaxDelay={props.retryMaxDelay}
        onTimeoutChange={props.onTimeoutChange}
        onRetriesChange={props.onRetriesChange}
        onPathRegexChange={props.onPathRegexChange}
        onRetryDelayChange={props.onRetryDelayChange}
        onRetryMaxDelayChange={props.onRetryMaxDelayChange}
        retryBackoffMultiplier={props.retryBackoffMultiplier}
        retryExponentialBackoff={props.retryExponentialBackoff}
        onRetryBackoffMultiplierChange={props.onRetryBackoffMultiplierChange}
        onRetryExponentialBackoffChange={props.onRetryExponentialBackoffChange}
      />

      {/* Authentication */}
      <EndpointAuth
        loading={loading}
        type={props.authType}
        enabled={props.authEnabled}
        secretName={props.authSecretName}
        headerName={props.authHeaderName}
        onTypeChange={props.onAuthTypeChange}
        onEnabledChange={props.onAuthEnabledChange}
        onSecretNameChange={props.onAuthSecretNameChange}
        onHeaderNameChange={props.onAuthHeaderNameChange}
      />

      {/* OAuth 2.0 */}
      <EndpointOAuth
        loading={loading}
        scopes={props.oauthScopes}
        params={props.oauthParams}
        enabled={props.oauthEnabled}
        tokenUrl={props.oauthTokenUrl}
        clientId={props.oauthClientId}
        availableSecrets={availableSecrets}
        clientSecret={props.oauthClientSecret}
        onScopesChange={props.onOauthScopesChange}
        onParamsChange={props.onOauthParamsChange}
        credentialStyle={props.oauthCredentialStyle}
        onEnabledChange={props.onOauthEnabledChange}
        onTokenUrlChange={props.onOauthTokenUrlChange}
        onClientIdChange={props.onOauthClientIdChange}
        onClientSecretChange={props.onOauthClientSecretChange}
        onCredentialStyleChange={props.onOauthCredentialStyleChange}
      />

      {/* Transform */}
      <EndpointTransform
        loading={loading}
        enabled={props.transformEnabled}
        injectSecrets={props.transformInjectSecrets}
        onEnabledChange={props.onTransformEnabledChange}
        onInjectSecretsChange={props.onTransformInjectSecretsChange}
      />

      {/* Domain Whitelist */}
      <EndpointWhitelist
        loading={loading}
        enabled={props.whitelistEnabled}
        domains={props.whitelistDomains}
        enforce={props.whitelistEnforce}
        logBlocked={props.whitelistLogBlocked}
        onEnabledChange={props.onWhitelistEnabledChange}
        onDomainsChange={props.onWhitelistDomainsChange}
        onEnforceChange={props.onWhitelistEnforceChange}
        onLogBlockedChange={props.onWhitelistLogBlockedChange}
      />
    </>
  )
}
