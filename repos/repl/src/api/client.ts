import type { AuthManager } from '@TRL/auth'
import type { TSessionInfo } from '@TRL/types'
import { Agent, Thread, Message, Organization } from '@tdsk/domain'

export class ApiClient {
  #auth: AuthManager

  constructor(auth: AuthManager) {
    this.#auth = auth
  }

  #getProxyUrl(): string {
    const creds = this.#auth.getCredentials()
    if (!creds) throw new Error(`Not logged in. Run "tdsk-agent login" first.`)
    return creds.proxyUrl
  }

  async #request<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
    const creds = this.#auth.getCredentials()
    if (!creds) throw new Error(`Not logged in. Run "tdsk-agent login" first.`)

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

  async #postRequest<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.#request<T>(path, {
      method: `POST`,
      headers: { 'Content-Type': `application/json` },
      body: JSON.stringify(body),
    })
  }

  get proxyUrl(): string {
    return this.#getProxyUrl()
  }

  // --- Organizations ---

  async listOrgs(): Promise<Organization[]> {
    const resp = await this.#request<Organization[]>(`/orgs`)
    return resp.map((item) => new Organization(item))
  }

  async getOrg(orgId: string): Promise<Organization> {
    const resp = await this.#request<Organization>(`/orgs/${orgId}`)
    return new Organization(resp)
  }

  // --- Agents ---

  async listAgents(orgId: string): Promise<Agent[]> {
    const resp = await this.#request<unknown[]>(`/orgs/${orgId}/agents`)
    return resp.map((item) => new Agent(item))
  }

  async getAgent(orgId: string, agentId: string): Promise<Agent> {
    const resp = await this.#request<Agent>(`/orgs/${orgId}/agents/${agentId}`)
    return new Agent(resp)
  }

  // --- Sessions ---

  async createSession(agentId: string): Promise<TSessionInfo> {
    return this.#postRequest<TSessionInfo>(`/ai/sessions`, { agentId })
  }

  // --- Threads ---

  async listThreads(orgId: string, agentId: string): Promise<Thread[]> {
    const resp = await this.#request<unknown[]>(
      `/orgs/${orgId}/agents/${agentId}/threads`
    )
    return resp.map((item) => new Thread(item))
  }

  async getThread(orgId: string, agentId: string, threadId: string): Promise<Thread> {
    const resp = await this.#request(
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
    threadId: string
  ): Promise<Message[]> {
    const resp = await this.#request<Message[]>(
      `/orgs/${orgId}/agents/${agentId}/threads/${threadId}/messages`
    )
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
