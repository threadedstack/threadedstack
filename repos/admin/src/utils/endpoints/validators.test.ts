import { describe, it, expect } from 'vitest'
import { vep } from './validators'
import type {
  TProxyFormState,
  TFaasFormState,
  TAgentFormState,
} from '@TAF/types/endpoints.types'

const baseProxyState: TProxyFormState = {
  url: `https://api.example.com`,
  proxyMethod: `GET`,
  headers: [],
  timeout: `30000`,
  retries: `0`,
  pathRegex: ``,
  retryDelay: `1000`,
  retryMaxDelay: `10000`,
  retryBackoffMultiplier: `2`,
  retryExponentialBackoff: false,
  authEnabled: false,
  authType: `basic`,
  authSecretId: ``,
  authHeaderName: ``,
  oauthScopes: ``,
  oauthEnabled: false,
  oauthTokenUrl: ``,
  oauthClientId: ``,
  oauthClientSecret: ``,
  oauthParams: [],
  oauthCredentialType: `body`,
  transformEnabled: false,
  transformInjectSecrets: false,
  whitelistDomains: ``,
  whitelistEnforce: false,
  whitelistEnabled: false,
  whitelistLogBlocked: false,
}

const baseFaasState: TFaasFormState = {
  memory: `128`,
  timeout: `30000`,
  secrets: [],
  functionId: `fn-1`,
  envVars: [],
  arguments: [],
}

const baseAgentState: TAgentFormState = {
  model: `gpt-4`,
  agentId: `agent-1`,
  tools: [],
  secrets: [],
  maxTokens: `1000`,
  systemPrompt: ``,
  functionIds: [],
  providerIds: [],
  envVars: [],
}

describe(`vep.proxy`, () => {
  it(`returns null for a fully valid state`, () => {
    expect(vep.proxy(baseProxyState)).toBeNull()
  })

  it(`requires a URL`, () => {
    expect(vep.proxy({ ...baseProxyState, url: `` })).toBe(
      `Proxy URL is required for proxy endpoints`
    )
  })

  it(`requires a URL when only whitespace is provided`, () => {
    expect(vep.proxy({ ...baseProxyState, url: `   ` })).toBe(
      `Proxy URL is required for proxy endpoints`
    )
  })

  it(`requires an auth secret when auth is enabled`, () => {
    expect(vep.proxy({ ...baseProxyState, authEnabled: true, authSecretId: `` })).toBe(
      `Auth secret is required when authentication is enabled`
    )
  })

  it(`does not require an auth secret when auth is disabled`, () => {
    expect(
      vep.proxy({ ...baseProxyState, authEnabled: false, authSecretId: `` })
    ).toBeNull()
  })

  it(`passes when auth is enabled and a secret is set`, () => {
    expect(
      vep.proxy({ ...baseProxyState, authEnabled: true, authSecretId: `sec-1` })
    ).toBeNull()
  })

  it(`requires an OAuth token URL when OAuth is enabled`, () => {
    expect(
      vep.proxy({
        ...baseProxyState,
        oauthEnabled: true,
        oauthTokenUrl: ``,
        oauthClientId: `client`,
        oauthClientSecret: `secret`,
      })
    ).toBe(`OAuth token URL is required when OAuth is enabled`)
  })

  it(`requires an OAuth client ID when OAuth is enabled`, () => {
    expect(
      vep.proxy({
        ...baseProxyState,
        oauthEnabled: true,
        oauthTokenUrl: `https://auth.example.com/token`,
        oauthClientId: ``,
        oauthClientSecret: `secret`,
      })
    ).toBe(`OAuth client ID is required when OAuth is enabled`)
  })

  it(`requires an OAuth client secret when OAuth is enabled`, () => {
    expect(
      vep.proxy({
        ...baseProxyState,
        oauthEnabled: true,
        oauthTokenUrl: `https://auth.example.com/token`,
        oauthClientId: `client`,
        oauthClientSecret: ``,
      })
    ).toBe(`OAuth client secret is required when OAuth is enabled`)
  })

  it(`passes when OAuth is enabled and all fields are set`, () => {
    expect(
      vep.proxy({
        ...baseProxyState,
        oauthEnabled: true,
        oauthTokenUrl: `https://auth.example.com/token`,
        oauthClientId: `client`,
        oauthClientSecret: `secret`,
      })
    ).toBeNull()
  })

  it(`does not validate OAuth fields when OAuth is disabled`, () => {
    expect(
      vep.proxy({
        ...baseProxyState,
        oauthEnabled: false,
        oauthTokenUrl: ``,
        oauthClientId: ``,
        oauthClientSecret: ``,
      })
    ).toBeNull()
  })

  it(`checks the URL before auth or OAuth fields`, () => {
    expect(
      vep.proxy({
        ...baseProxyState,
        url: ``,
        authEnabled: true,
        authSecretId: ``,
        oauthEnabled: true,
        oauthTokenUrl: ``,
      })
    ).toBe(`Proxy URL is required for proxy endpoints`)
  })
})

describe(`vep.faas`, () => {
  it(`returns null when a function is selected`, () => {
    expect(vep.faas(baseFaasState)).toBeNull()
  })

  it(`requires a function to be selected`, () => {
    expect(vep.faas({ ...baseFaasState, functionId: `` })).toBe(
      `Please select a function for FAAS endpoints`
    )
  })

  it(`requires a function when only whitespace is provided`, () => {
    expect(vep.faas({ ...baseFaasState, functionId: `   ` })).toBe(
      `Please select a function for FAAS endpoints`
    )
  })
})

describe(`vep.agent`, () => {
  it(`returns null when an agent is selected`, () => {
    expect(vep.agent(baseAgentState)).toBeNull()
  })

  it(`requires an agent to be selected`, () => {
    expect(vep.agent({ ...baseAgentState, agentId: `` })).toBe(
      `Please select an agent for agent endpoints`
    )
  })

  it(`requires an agent when only whitespace is provided`, () => {
    expect(vep.agent({ ...baseAgentState, agentId: `   ` })).toBe(
      `Please select an agent for agent endpoints`
    )
  })
})

describe(`vep.shared`, () => {
  it(`returns null for a valid name and path`, () => {
    expect(vep.shared(`My Endpoint`, `/my-endpoint`)).toBeNull()
  })

  it(`requires a name`, () => {
    expect(vep.shared(``, `/my-endpoint`)).toBe(`Endpoint name is required`)
  })

  it(`requires a name when only whitespace is provided`, () => {
    expect(vep.shared(`   `, `/my-endpoint`)).toBe(`Endpoint name is required`)
  })

  it(`requires a path`, () => {
    expect(vep.shared(`My Endpoint`, ``)).toBe(`Endpoint path is required`)
  })

  it(`requires a path when only whitespace is provided`, () => {
    expect(vep.shared(`My Endpoint`, `   `)).toBe(`Endpoint path is required`)
  })

  it(`requires the path to start with a slash`, () => {
    expect(vep.shared(`My Endpoint`, `my-endpoint`)).toBe(
      `Endpoint path must start with /`
    )
  })

  it(`checks the name before the path`, () => {
    expect(vep.shared(``, ``)).toBe(`Endpoint name is required`)
  })

  it(`checks path presence before the leading-slash rule`, () => {
    expect(vep.shared(`My Endpoint`, ``)).toBe(`Endpoint path is required`)
  })
})
