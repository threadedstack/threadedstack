import type { AuthManager } from '@TSA/services/auth'
import type { TSessionInfo, TProviderInfo } from '@TSA/types'
import type { TApiRequest, TApiResponse, TSandboxSession } from '@tdsk/domain'

import { ApiService, Exception } from '@tdsk/domain'
import { MaxRetries, RetryDelays } from '@TSA/constants'
import { Agent, Thread, Message, Organization } from '@tdsk/domain'
import { RetryStatusCodes, RetryNetworkCodes } from '@TSA/constants/api'

export class ApiClient extends ApiService {
  #auth: AuthManager

  constructor(auth: AuthManager) {
    const creds = auth.creds()
    super({
      url: creds?.proxyUrl ?? ``,
      basePath: `_`,
      headers: {
        Accept: `application/json`,
        [`Content-Type`]: `application/json`,
        ...(creds?.apiKey ? { Authorization: `Bearer ${creds.apiKey}` } : {}),
      },
    })
    this.#auth = auth
  }

  #ensureAuth(): void {
    const creds = this.#auth.creds()
    if (!creds) throw new Error(`Not logged in. Run "tsa login" first.`)
    this.url = creds.proxyUrl
    this.setBearer(creds.apiKey)
  }

  get proxyUrl(): string {
    const creds = this.#auth.creds()
    if (!creds) throw new Error(`Not logged in. Run "tsa login" first.`)
    return creds.proxyUrl
  }

  protected override async invoke<T>(
    opts: TApiRequest & { method: import('@tdsk/domain').EApiMethod }
  ): Promise<TApiResponse<T>> {
    this.#ensureAuth()

    let lastResult: TApiResponse<T> | undefined
    for (let attempt = 0; attempt <= MaxRetries; attempt++) {
      const result = await super.invoke<T>(opts)

      if (result.ok) return result

      // Check if retryable
      const isRetryable = this.#isRetryableResult(result)
      if (!isRetryable || attempt === MaxRetries) return result

      await this.#delay(RetryDelays[attempt] ?? RetryDelays[RetryDelays.length - 1])
      lastResult = result
    }

    return lastResult!
  }

  #isRetryableResult(result: TApiResponse<unknown>): boolean {
    // Network errors come back with status 0
    if (result.status === 0) {
      const msg = result.error?.message ?? ``
      for (const code of RetryNetworkCodes) {
        if (msg.includes(code)) return true
      }
      return true // any network-level error is retryable
    }
    return RetryStatusCodes.has(result.status)
  }

  #delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // --- Organizations ---

  async listOrgs(): Promise<TApiResponse<Organization[]>> {
    const result = await this.get<Organization[]>({ path: `orgs` })
    if (result.ok && result.data)
      result.data = result.data.map((item) => new Organization(item))
    return result
  }

  async getOrg(orgId: string): Promise<TApiResponse<Organization>> {
    const result = await this.get<Organization>({ path: `orgs/${orgId}` })
    if (result.ok && result.data) result.data = new Organization(result.data)
    return result
  }

  // --- Agents ---

  async listAgents(orgId: string): Promise<TApiResponse<Agent[]>> {
    const result = await this.get<unknown[]>({ path: `orgs/${orgId}/agents` })
    if (result.ok && result.data)
      (result as TApiResponse<Agent[]>).data = result.data.map((item) => new Agent(item))
    return result as TApiResponse<Agent[]>
  }

  async getAgent(orgId: string, agentId: string): Promise<TApiResponse<Agent>> {
    const result = await this.get<Agent>({ path: `orgs/${orgId}/agents/${agentId}` })
    if (result.ok && result.data) result.data = new Agent(result.data)
    return result
  }

  // --- Sessions ---

  async createSession(
    agentId: string,
    providerId?: string
  ): Promise<TApiResponse<TSessionInfo>> {
    return this.post<TSessionInfo>({
      path: `ai/sessions`,
      data: {
        agentId,
        ...(providerId && { providerId }),
      },
    })
  }

  // --- Providers ---

  async listProviders(orgId: string): Promise<TApiResponse<TProviderInfo[]>> {
    return this.get<TProviderInfo[]>({ path: `orgs/${orgId}/providers` })
  }

  // --- Threads ---

  async listThreads(orgId: string, agentId: string): Promise<TApiResponse<Thread[]>> {
    const result = await this.get<unknown[]>({
      path: `orgs/${orgId}/agents/${agentId}/threads`,
    })
    if (result.ok && result.data)
      (result as TApiResponse<Thread[]>).data = result.data.map(
        (item) => new Thread(item)
      )
    return result as TApiResponse<Thread[]>
  }

  async getThread(
    orgId: string,
    agentId: string,
    threadId: string,
    opts?: { include?: string[] }
  ): Promise<TApiResponse<Thread>> {
    const params: Record<string, any> = {}
    if (opts?.include?.length) params.include = opts.include.join(`,`)
    const result = await this.get<Thread>({
      path: `orgs/${orgId}/agents/${agentId}/threads/${threadId}`,
      ...(Object.keys(params).length ? { data: params } : {}),
    })
    if (result.ok && result.data) result.data = new Thread(result.data)
    return result
  }

  async branchThread(
    orgId: string,
    agentId: string,
    threadId: string,
    messageId: string
  ): Promise<TApiResponse<Thread>> {
    const result = await this.post<Thread>({
      data: { messageId },
      path: `orgs/${orgId}/agents/${agentId}/threads/${threadId}/branch`,
    })
    if (result.ok && result.data) result.data = new Thread(result.data)
    return result
  }

  async createThread(
    orgId: string,
    agentId: string,
    name?: string
  ): Promise<TApiResponse<Thread>> {
    const result = await this.post<Thread>({
      data: { name: name || `TSA session` },
      path: `orgs/${orgId}/agents/${agentId}/threads`,
    })
    if (result.ok && result.data) result.data = new Thread(result.data)
    return result
  }

  // --- Projects ---

  async listProjects(orgId: string): Promise<TApiResponse<any[]>> {
    return this.get<any[]>({ path: `orgs/${orgId}/projects` })
  }

  // --- Thread Deletion ---

  async deleteThread(
    orgId: string,
    agentId: string,
    threadId: string
  ): Promise<TApiResponse<void>> {
    return this.delete<void>({
      path: `orgs/${orgId}/agents/${agentId}/threads/${threadId}`,
    })
  }

  // --- Sandboxes ---

  async listSandboxes(orgId: string, projectId?: string): Promise<TApiResponse<any[]>> {
    const path = projectId
      ? `orgs/${orgId}/projects/${projectId}/sandboxes`
      : `orgs/${orgId}/sandboxes`
    return this.get<any[]>({ path })
  }

  async connectSandbox(
    orgId: string,
    projectId: string,
    sandboxId: string
  ): Promise<TApiResponse<any>> {
    return this.post<any>({
      path: `orgs/${orgId}/projects/${projectId}/sandboxes/${sandboxId}/connect`,
      data: {},
    })
  }

  async getSandbox(orgId: string, sandboxId: string): Promise<TApiResponse<any>> {
    return this.get<any>({ path: `orgs/${orgId}/sandboxes/${sandboxId}` })
  }

  async getSandboxSessions(
    orgId: string,
    projectId: string,
    sandboxId: string
  ): Promise<TApiResponse<TSandboxSession[]>> {
    return this.get<TSandboxSession[]>({
      path: `orgs/${orgId}/projects/${projectId}/sandboxes/${sandboxId}/sessions`,
    })
  }

  async execInSandbox(
    orgId: string,
    projectId: string,
    sandboxId: string,
    podName: string,
    command: string
  ): Promise<TApiResponse<any>> {
    return this.post<any>({
      path: `orgs/${orgId}/projects/${projectId}/sandboxes/${sandboxId}/exec`,
      data: { command, podName },
    })
  }

  async injectSshKey(
    orgId: string,
    projectId: string,
    sandboxId: string,
    podName: string,
    publicKey: string
  ): Promise<TApiResponse> {
    if (!/^ssh-\S+ \S+/.test(publicKey)) {
      return {
        ok: false,
        status: 0,
        error: new Exception(400, `Invalid SSH public key format`),
      }
    }
    const escaped = publicKey.replace(/'/g, `'\\''`)
    const result = await this.execInSandbox(
      orgId,
      projectId,
      sandboxId,
      podName,
      [
        `mkdir -p /home/sandbox/.ssh`,
        `echo '${escaped}' > /home/sandbox/.ssh/authorized_keys`,
        `chmod 700 /home/sandbox/.ssh`,
        `chmod 600 /home/sandbox/.ssh/authorized_keys`,
        `chown -R sandbox:sandbox /home/sandbox/.ssh`,
      ].join(` && `)
    )

    if (!result.ok || !result.data?.success) {
      const msg = `SSH key injection failed in pod ${podName}: ${result.data?.output || result.data?.error || result.error?.message || `unknown error`}`
      return {
        ok: false,
        status: result.status,
        error: new Exception(result.status, msg),
      }
    }

    return { ok: true, status: result.status }
  }

  // --- Messages ---

  async listMessages(
    orgId: string,
    agentId: string,
    threadId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<TApiResponse<Message[]>> {
    const params: Record<string, any> = {}
    if (opts?.limit != null) params.limit = String(opts.limit)
    if (opts?.offset != null) params.offset = String(opts.offset)

    const result = await this.get<Message[]>({
      path: `orgs/${orgId}/agents/${agentId}/threads/${threadId}/messages`,
      ...(Object.keys(params).length ? { data: params } : {}),
    })

    if (result.ok && result.data)
      result.data = result.data.map((item) => new Message(item))
    return result
  }

  async createMessage(
    orgId: string,
    agentId: string,
    threadId: string,
    data: { type: string; content: unknown[]; orgId: string }
  ): Promise<TApiResponse<Message>> {
    const result = await this.post<Message>({
      data,
      path: `orgs/${orgId}/agents/${agentId}/threads/${threadId}/messages`,
    })
    if (result.ok && result.data) result.data = new Message(result.data)
    return result
  }
}
