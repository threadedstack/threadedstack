import type { TKeyValuePair } from '@TAF/types'
import type { TEPCredential, TEPAuthType, Secret } from '@tdsk/domain'

import { HttpMethodOps } from '@TAF/constants/values'
import { TextInput, SelectInput } from '@tdsk/components'
import { EndpointAuth } from '@TAF/components/Endpoints/Proxy/EndpointAuth'
import { EndpointOAuth } from '@TAF/components/Endpoints/Proxy/EndpointOAuth'
import { EndpointHeaders } from '@TAF/components/Endpoints/Proxy/EndpointHeaders'
import { EndpointTransform } from '@TAF/components/Endpoints/Proxy/EndpointTransform'
import { EndpointWhitelist } from '@TAF/components/Endpoints/Proxy/EndpointWhitelist'
import { EndpointBasicOptions } from '@TAF/components/Endpoints/Proxy/EndpointBasicOptions'

const ProxyMethodOps = [{ label: `Use Endpoint Method`, value: `` }, ...HttpMethodOps]

export type TProxyInputs = {
  loading: boolean
  // Basic fields
  url: string
  proxyMethod: string
  onUrlChange: (value: string) => void
  onProxyMethodChange: (value: string) => void

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
  authType: TEPAuthType
  authSecretId: string
  authHeaderName: string
  onAuthEnabledChange: (value: boolean) => void
  onAuthTypeChange: (value: TEPAuthType) => void
  onAuthSecretIdChange: (value: string) => void
  onAuthHeaderNameChange: (value: string) => void

  // OAuth
  oauthEnabled: boolean
  oauthTokenUrl: string
  oauthClientId: string
  oauthClientSecret: string
  oauthScopes: string
  oauthCredentialType: TEPCredential
  oauthParams: TKeyValuePair[]
  onOauthEnabledChange: (value: boolean) => void
  onOauthTokenUrlChange: (value: string) => void
  onOauthClientIdChange: (value: string) => void
  onOauthClientSecretChange: (value: string) => void
  onOauthScopesChange: (value: string) => void
  onOauthCredentialStyleChange: (value: TEPCredential) => void
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

export const ProxyInputs = (props: TProxyInputs) => {
  const { loading, availableSecrets } = props

  return (
    <>
      {/* Proxy URL */}
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
        id='proxy-method-select'
        disabled={loading}
        label='Proxy Method (Optional)'
        items={ProxyMethodOps}
        value={props.proxyMethod.toLowerCase()}
        onChange={(e) => props.onProxyMethodChange(e.target.value)}
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
        secrets={availableSecrets}
        enabled={props.authEnabled}
        secretId={props.authSecretId}
        headerName={props.authHeaderName}
        onTypeChange={props.onAuthTypeChange}
        onEnabledChange={props.onAuthEnabledChange}
        onSecretIdChange={props.onAuthSecretIdChange}
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
        credentialType={props.oauthCredentialType}
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
