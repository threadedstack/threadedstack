import type { TKeyValuePair } from '@TAF/types'
import type {
  Secret,
  Endpoint,
  TEPAuthType,
  TEPCredential,
  TEndpointType,
  Function as FunctionModel,
} from '@tdsk/domain'

export type TProxyFormState = {
  // Basic fields
  url: string
  proxyMethod: string

  // Headers
  headers: TKeyValuePair[]

  // Basic options
  timeout: string
  retries: string
  pathRegex: string

  // Retry configuration
  retryDelay: string
  retryMaxDelay: string
  retryBackoffMultiplier: string
  retryExponentialBackoff: boolean

  // Auth
  authEnabled: boolean
  authType: TEPAuthType
  authSecretId: string
  authHeaderName: string

  // OAuth
  oauthScopes: string
  oauthEnabled: boolean
  oauthTokenUrl: string
  oauthClientId: string
  oauthClientSecret: string
  oauthParams: TKeyValuePair[]
  oauthCredentialType: TEPCredential

  // Transform
  transformEnabled: boolean
  transformInjectSecrets: boolean

  // Domain whitelist
  whitelistDomains: string
  whitelistEnforce: boolean
  whitelistEnabled: boolean
  whitelistLogBlocked: boolean
}

export type TFaasFormState = {
  memory: string
  timeout: string
  secrets: string[]
  functionId: string
  envVars: TKeyValuePair[]
  arguments: TKeyValuePair[]
}

export type TAgentFormState = {
  model: string
  agentId: string
  tools: string[]
  secrets: string[]
  maxTokens: string
  systemPrompt: string
  envVars: TKeyValuePair[]
}

export type TEndpointFormProps<T> = {
  loading: boolean
  endpoint?: Endpoint | null
  availableSecrets: Secret[]
  availableFunctions?: FunctionModel[]
  onConfigChange: (config: T) => void
  onValidate: (error: string | null) => void
}

export type TSharedFormState = {
  name: string
  path: string
  method: string
  public: boolean
  endpointType: TEndpointType
}
