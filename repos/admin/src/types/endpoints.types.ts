import type { TKeyValuePair } from '@TAF/types'
import type {
  Secret,
  Endpoint,
  TEndpointType,
  Function as TDFunction,
} from '@tdsk/domain'

export type TProxyFormState = {
  // Basic fields
  url: string
  method: string

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
  authType: `bearer` | `basic` | `apikey`
  authSecretName: string
  authHeaderName: string

  // OAuth
  oauthEnabled: boolean
  oauthTokenUrl: string
  oauthClientId: string
  oauthClientSecret: string
  oauthScopes: string
  oauthCredentialStyle: `header` | `body`
  oauthParams: TKeyValuePair[]

  // Transform
  transformEnabled: boolean
  transformInjectSecrets: boolean

  // Domain whitelist
  whitelistEnabled: boolean
  whitelistDomains: string
  whitelistEnforce: boolean
  whitelistLogBlocked: boolean
}

export type TFaasFormState = {
  functionId: string
  memory: string
  timeout: string
  secrets: string[]
  envVars: TKeyValuePair[]
  arguments: TKeyValuePair[]
}

export type TAgentFormState = {
  agentId: string
  model: string
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
  availableFunctions?: TDFunction[]
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
