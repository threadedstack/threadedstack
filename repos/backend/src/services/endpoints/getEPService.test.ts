import { describe, it, expect, vi } from 'vitest'

import { EEndpointType } from '@tdsk/domain'
import { getEPService } from '@TBE/services/endpoints/getEPService'
import { FaaSEndpoint } from '@TBE/services/endpoints/faasEndpoint'
import { ProxyEndpoint } from '@TBE/services/endpoints/proxyEndpoint'
import { AgentEndpoint } from '@TBE/services/endpoints/agentEndpoint'

// Mock logger
vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// Mock http-proxy-middleware (needed by ProxyEndpoint)
vi.mock(`http-proxy-middleware`, () => ({
  createProxyMiddleware: vi.fn(),
  responseInterceptor: vi.fn(),
}))

// Mock ProxyService and RetryService (needed by ProxyEndpoint constructor)
vi.mock(`@TBE/services/proxy`, () => ({
  ProxyService: vi.fn().mockImplementation(() => ({
    applyEndpointOptions: vi.fn().mockReturnValue({}),
    applyEndpointOptionsAsync: vi.fn().mockResolvedValue(undefined),
    applyTransform: vi.fn().mockReturnValue({}),
  })),
  RetryService: vi.fn().mockImplementation(() => ({
    meta: { get: vi.fn(), update: vi.fn(), init: vi.fn() },
    config: { maxRetries: 0 },
    shouldRetry: vi.fn().mockReturnValue(false),
    delayRetry: vi.fn().mockResolvedValue(undefined),
    logStatus: vi.fn(),
    setup: vi.fn().mockReturnValue({ maxRetries: 0 }),
  })),
}))

// Mock addEndpointHeaders (needed by ProxyEndpoint)
vi.mock(`@TBE/utils/proxy`, () => ({
  addEndpointHeaders: vi.fn(),
}))

// Mock FunctionExecutor (needed by FaaSEndpoint)
vi.mock(`@TBE/services/functions/functionExecutor`, () => ({
  FunctionExecutor: { execute: vi.fn() },
}))

// Mock AgentRunner (needed transitively by AgentEndpoint via agentHelper)
vi.mock(`@tdsk/agent`, () => ({
  AgentRunner: { run: vi.fn() },
}))

// Mock SecretResolver (needed by agentHelper)
vi.mock(`@TBE/services/secrets/secretResolver`, () => ({
  SecretResolver: vi.fn(),
}))

// Mock resolveProviderType (needed by agentHelper)
vi.mock(`@TBE/utils/providers/resolveProviderType`, () => ({
  resolveProviderType: vi.fn(),
}))

// Mock checkPermission (needed by base)
vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: vi.fn(),
}))

describe(`getEPService`, () => {
  it(`should return ProxyEndpoint for proxy type`, () => {
    const service = getEPService(EEndpointType.proxy)
    expect(service).toBeInstanceOf(ProxyEndpoint)
    expect(service.type).toBe(EEndpointType.proxy)
  })

  it(`should return FaaSEndpoint for faas type`, () => {
    const service = getEPService(EEndpointType.faas)
    expect(service).toBeInstanceOf(FaaSEndpoint)
    expect(service.type).toBe(EEndpointType.faas)
  })

  it(`should return AgentEndpoint for agent type`, () => {
    const service = getEPService(EEndpointType.agent)
    expect(service).toBeInstanceOf(AgentEndpoint)
    expect(service.type).toBe(EEndpointType.agent)
  })

  it(`should throw Exception for unsupported type`, () => {
    expect(() => getEPService(`unknown`)).toThrow(`Unsupported endpoint type: unknown`)
  })

  it(`should return same singleton instance on multiple calls`, () => {
    const first = getEPService(EEndpointType.proxy)
    const second = getEPService(EEndpointType.proxy)
    expect(first).toBe(second)
  })
})
