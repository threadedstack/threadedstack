import type { AuthManager } from '@TRL/auth'

export class ApiClient {
  #auth: AuthManager

  constructor(auth: AuthManager) {
    this.#auth = auth
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

  // --- Organizations ---

  async listOrgs(): Promise<unknown[]> {
    return this.#request<unknown[]>(`/orgs`)
  }

  async getOrg(orgId: string): Promise<unknown> {
    return this.#request(`/orgs/${orgId}`)
  }

  // --- Agents ---

  async listAgents(orgId: string): Promise<unknown[]> {
    return this.#request<unknown[]>(`/orgs/${orgId}/agents`)
  }

  async getAgent(orgId: string, agentId: string): Promise<unknown> {
    return this.#request(`/orgs/${orgId}/agents/${agentId}`)
  }

  // --- Agent Resolution ---

  async resolveAgent(orgId: string, agentId: string): Promise<unknown> {
    return this.#postRequest(`/orgs/${orgId}/agents/${agentId}/resolve`, {})
  }

  // --- Threads ---

  async listThreads(orgId: string, agentId: string): Promise<unknown[]> {
    return this.#request<unknown[]>(`/orgs/${orgId}/agents/${agentId}/threads`)
  }

  async getThread(orgId: string, agentId: string, threadId: string): Promise<unknown> {
    return this.#request(`/orgs/${orgId}/agents/${agentId}/threads/${threadId}`)
  }

  async createThread(orgId: string, agentId: string, name?: string): Promise<unknown> {
    return this.#postRequest(`/orgs/${orgId}/agents/${agentId}/threads`, {
      name: name || `REPL session`,
    })
  }

  // --- Messages ---

  async listMessages(
    orgId: string,
    agentId: string,
    threadId: string
  ): Promise<unknown[]> {
    return this.#request<unknown[]>(
      `/orgs/${orgId}/agents/${agentId}/threads/${threadId}/messages`
    )
  }

  async createMessage(
    orgId: string,
    agentId: string,
    threadId: string,
    data: { type: string; content: unknown[]; orgId: string }
  ): Promise<unknown> {
    return this.#postRequest(
      `/orgs/${orgId}/agents/${agentId}/threads/${threadId}/messages`,
      data
    )
  }
}
