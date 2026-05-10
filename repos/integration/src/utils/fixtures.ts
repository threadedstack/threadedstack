import type { TAIProviderBrand } from '@tdsk/domain'

import { env } from './env'
import { uniqueName } from './unique-name'
import { get, post, put, del } from './api-client'

export type TFixtureOptions = {
  orgId: string
  model?: string
  apiKey?: string
  agentName?: string
  projectName?: string
  systemPrompt?: string
  createAgent?: boolean
  createEndpoint?: boolean
  providerBrand?: TAIProviderBrand
}

export type TFixtureResult = {
  agent?: Record<string, any>
  secret?: Record<string, any>
  project?: Record<string, any>
  provider?: Record<string, any>
  endpoint?: Record<string, any>
}

const DefaultModels: Partial<Record<string, string>> = {
  anthropic: `claude-sonnet-4-20250514`,
  openai: `gpt-4o`,
  google: `gemini-2.0-flash`,
  zai: `glm-4.5`,
  ollama: `llama3`,
  custom: `default`,
}

export const setupFixtures = async (opts: TFixtureOptions): Promise<TFixtureResult> => {
  const {
    orgId,
    providerBrand = `anthropic`,
    apiKey = env.testProviderKey,
    projectName = uniqueName(`project`),
    agentName = uniqueName(`agent`),
    model = DefaultModels[providerBrand] || DefaultModels.anthropic,
    systemPrompt,
    createAgent = true,
    createEndpoint = true,
  } = opts

  const result: TFixtureResult = {}

  try {
    const provResp = await post(`/orgs/${orgId}/providers`, {
      name: uniqueName(`${providerBrand}-provider`),
      type: `ai`,
      orgId,
      brand: providerBrand,
      options: {},
    })
    if (provResp.status !== 201) throw new Error(`Failed to create provider: ${provResp.status}`)
    result.provider = provResp.data

    const secretResp = await post(`/orgs/${orgId}/secrets`, {
      name: uniqueName(`${providerBrand}-key`),
      value: apiKey,
      providerId: result.provider.id,
    })
    if (secretResp.status !== 201) throw new Error(`Failed to create secret: ${secretResp.status}`)
    result.secret = secretResp.data

    const linkResp = await put(`/orgs/${orgId}/providers/${result.provider.id}`, {
      secretId: result.secret.id,
    })
    if (linkResp.status !== 200) throw new Error(`Failed to link secret to provider: ${linkResp.status}`)
    result.provider = linkResp.data ?? result.provider

    const projResp = await post(`/orgs/${orgId}/projects`, {
      name: projectName,
      orgId,
    })
    if (projResp.status !== 201) throw new Error(`Failed to create project: ${projResp.status}`)
    result.project = projResp.data

    if (createAgent) {
      const agentResp = await post(`/orgs/${orgId}/agents`, {
        name: agentName,
        orgId,
        providerInputs: [{ id: result.provider.id }],
        projectIds: [result.project.id],
        ...(model && { model }),
        maxTokens: 100000,
        ...(systemPrompt && { systemPrompt }),
      })
      if (agentResp.status !== 201) throw new Error(`Failed to create agent: ${agentResp.status}`)
      result.agent = agentResp.data

      if (createEndpoint) {
        const slug = agentName.toLowerCase().replace(/[^a-z0-9-]/g, `-`)
        const epResp = await post(`/orgs/${orgId}/projects/${result.project.id}/endpoints`, {
          name: `${agentName}-endpoint`,
          path: `/ai/${slug}-${Date.now()}`,
          type: `agent`,
          method: `post`,
          projectId: result.project.id,
          options: { agentId: result.agent.id },
        })
        if (epResp.status !== 201) throw new Error(`Failed to create endpoint: ${epResp.status}`)
        result.endpoint = epResp.data
      }
    }

    return result
  } catch (err) {
    await cleanupFixtures(orgId, result).catch(() => {})
    throw err
  }
}

export const cleanupFixtures = async (
  orgId: string,
  result: TFixtureResult
): Promise<void> => {
  if (result.endpoint?.id && result.project?.id)
    await del(`/orgs/${orgId}/projects/${result.project.id}/endpoints/${result.endpoint.id}`).catch((e) => console.warn(`[fixtures] cleanup endpoint failed:`, e?.message))
  if (result.agent?.id) {
    const threadsRes = await get<{ id: string }[]>(`/orgs/${orgId}/agents/${result.agent.id}/threads?limit=200`).catch(() => ({ ok: false, data: [] }))
    if (threadsRes.ok) {
      for (const thread of (threadsRes.data || [])) {
        await del(`/orgs/${orgId}/agents/${result.agent.id}/threads/${thread.id}`).catch((e) => console.warn(`[fixtures] cleanup thread failed:`, e?.message))
      }
    }
    await del(`/orgs/${orgId}/agents/${result.agent.id}`).catch((e) => console.warn(`[fixtures] cleanup agent failed:`, e?.message))
  }
  if (result.project?.id)
    await del(`/orgs/${orgId}/projects/${result.project.id}`).catch((e) => console.warn(`[fixtures] cleanup project failed:`, e?.message))
  if (result.secret?.id)
    await del(`/orgs/${orgId}/secrets/${result.secret.id}`).catch((e) => console.warn(`[fixtures] cleanup secret failed:`, e?.message))
  if (result.provider?.id)
    await del(`/orgs/${orgId}/providers/${result.provider.id}`).catch((e) => console.warn(`[fixtures] cleanup provider failed:`, e?.message))
}
