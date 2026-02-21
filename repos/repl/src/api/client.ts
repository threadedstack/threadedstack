import type { AuthManager } from '@TRL/auth'
import type { TSessionInfo, TProviderInfo } from '@TRL/types'

import { MaxRetries, RetryDelays } from '@TRL/constants'
import { Agent, Thread, Message, Organization } from '@tdsk/domain'

export class ApiClient {
  #auth: AuthManager

  constructor(auth: AuthManager) {
    this.#auth = auth
  }

  #getProxyUrl(): string {
    const creds = this.#auth.getCredentials()
    if (!creds) throw new Error(`Not logged in. Run "tsa login" first.`)
    return creds.proxyUrl
  }

  async #request<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
    const creds = this.#auth.getCredentials()
    if (!creds) throw new Error(`Not logged in. Run "tsa login" first.`)

    const url = `${creds.proxyUrl}/_${path}`
    const res = await fetch(url, {
      ...opts,
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        Accept: `application/json`,
        ...opts?.headers,
      },
    })

    if (!res.ok) {
      const body = await res.text().catch(() => ``)
      throw new Error(`API error (${res.status}): ${body || res.statusText}`)
    }

    const json = (await res.json()) as { data: T }
    return json.data
  }

  async #requestWithRetry<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
    let lastError: Error | undefined
    for (let attempt = 0; attempt <= MaxRetries; attempt++) {
      try {
        return await this.#request<T>(path, opts)
      } catch (error) {
        lastError = error as Error
        const isRetryable = this.#isRetryableError(lastError)
        if (!isRetryable || attempt === MaxRetries) throw lastError
        await this.#delay(RetryDelays[attempt])
      }
    }
    throw lastError!
  }

  #isRetryableError(error: Error): boolean {
    const msg = error.message
    if ('code' in error) {
      const code = (error as any).code
      if (code === `ECONNREFUSED` || code === `ETIMEDOUT` || code === `ENOTFOUND`)
        return true
    }
    if (
      msg.includes(`(429)`) ||
      msg.includes(`(500)`) ||
      msg.includes(`(502)`) ||
      msg.includes(`(503)`)
    )
      return true
    return false
  }

  #delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async #postRequest<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.#requestWithRetry<T>(path, {
      method: `POST`,
      headers: { [`Content-Type`]: `application/json` },
      body: JSON.stringify(body),
    })
  }

  get proxyUrl(): string {
    return this.#getProxyUrl()
  }

  // --- Organizations ---

  async listOrgs(): Promise<Organization[]> {
    const resp = await this.#requestWithRetry<Organization[]>(`/orgs`)
    return resp.map((item) => new Organization(item))
  }

  async getOrg(orgId: string): Promise<Organization> {
    const resp = await this.#requestWithRetry<Organization>(`/orgs/${orgId}`)
    return new Organization(resp)
  }

  // --- Agents ---

  async listAgents(orgId: string): Promise<Agent[]> {
    const resp = await this.#requestWithRetry<unknown[]>(`/orgs/${orgId}/agents`)
    return resp.map((item) => new Agent(item))
  }

  async getAgent(orgId: string, agentId: string): Promise<Agent> {
    const resp = await this.#requestWithRetry<Agent>(`/orgs/${orgId}/agents/${agentId}`)
    return new Agent(resp)
  }

  // --- Sessions ---

  async createSession(agentId: string, providerId?: string): Promise<TSessionInfo> {
    return this.#postRequest<TSessionInfo>(`/ai/sessions`, {
      agentId,
      ...(providerId && { providerId }),
    })
  }

  // --- Providers ---

  async listProviders(orgId: string): Promise<TProviderInfo[]> {
    return this.#requestWithRetry<TProviderInfo[]>(`/orgs/${orgId}/providers`)
  }

  // --- Threads ---

  async listThreads(orgId: string, agentId: string): Promise<Thread[]> {
    const resp = await this.#requestWithRetry<unknown[]>(
      `/orgs/${orgId}/agents/${agentId}/threads`
    )
    return resp.map((item) => new Thread(item))
  }

  async getThread(orgId: string, agentId: string, threadId: string): Promise<Thread> {
    const resp = await this.#requestWithRetry(
      `/orgs/${orgId}/agents/${agentId}/threads/${threadId}`
    )
    return new Thread(resp)
  }

  async createThread(orgId: string, agentId: string, name?: string): Promise<Thread> {
    const resp = await this.#postRequest<Thread>(
      `/orgs/${orgId}/agents/${agentId}/threads`,
      {
        name: name || `REPL session`,
      }
    )
    return new Thread(resp)
  }

  // --- Messages ---

  async listMessages(
    orgId: string,
    agentId: string,
    threadId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<Message[]> {
    const params = new URLSearchParams()
    if (opts?.limit != null) params.set('limit', String(opts.limit))
    if (opts?.offset != null) params.set('offset', String(opts.offset))
    const qs = params.toString()
    const path = `/orgs/${orgId}/agents/${agentId}/threads/${threadId}/messages${qs ? `?${qs}` : ''}`
    const resp = await this.#requestWithRetry<Message[]>(path)
    return resp.map((item) => new Message(item))
  }

  async createMessage(
    orgId: string,
    agentId: string,
    threadId: string,
    data: { type: string; content: unknown[]; orgId: string }
  ): Promise<Message> {
    const resp = await this.#postRequest<Message>(
      `/orgs/${orgId}/agents/${agentId}/threads/${threadId}/messages`,
      data
    )
    return new Message(resp)
  }
}
