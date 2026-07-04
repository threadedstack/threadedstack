import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  resolveProviderEnv,
  resolveOneProviderEnv,
  resolveProviderEnvChain,
} from './resolveProviderEnv'

// Unique token per call so merged placeholder maps never collide across providers.
vi.mock(`nanoid`, () => {
  let n = 0
  return { nanoid: () => `mock_nanoid_${n++}` }
})

const mockSecretResolver = {
  resolveApiKey: vi.fn().mockResolvedValue(`decrypted-api-key`),
} as any

describe(`resolveProviderEnv`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSecretResolver.resolveApiKey.mockResolvedValue(`decrypted-api-key`)
  })

  it(`returns empty for no providers`, async () => {
    const result = await resolveProviderEnv(
      `claude-code`,
      [],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv).toEqual({})
    expect(result.placeholders).toEqual({})
    expect(result.errors).toEqual([])
  })

  it(`returns empty for unknown runtime`, async () => {
    const result = await resolveProviderEnv(
      `unknown-runtime`,
      [{ provider: { id: `p1`, brand: `anthropic`, secretId: `sec_1` }, priority: 0 }],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv).toEqual({})
  })

  it(`generates MITM placeholder for anthropic API key`, async () => {
    const result = await resolveProviderEnv(
      `claude-code`,
      [{ provider: { id: `p1`, brand: `anthropic`, secretId: `sec_1` }, priority: 0 }],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.ANTHROPIC_API_KEY).toMatch(/^tdsk_ph_/)
    expect(Object.keys(result.placeholders)).toHaveLength(1)
    expect(Object.values(result.placeholders)[0]).toEqual({
      secretId: `sec_1`,
      allowedDomains: [`api.anthropic.com`],
    })
    expect(result.errors).toEqual([])
  })

  it(`injects static values and direct secrets for bedrock`, async () => {
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: {
            id: `p1`,
            brand: `amazon-bedrock`,
            secretId: `sec_1`,
            options: { region: `us-east-1`, accessKeyId: `AKID123` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.CLAUDE_CODE_USE_BEDROCK).toBe(`1`)
    expect(result.extraEnv.AWS_REGION).toBe(`us-east-1`)
    expect(result.extraEnv.AWS_ACCESS_KEY_ID).toBe(`AKID123`)
    expect(result.extraEnv.AWS_SECRET_ACCESS_KEY).toBe(`decrypted-api-key`)
    expect(Object.keys(result.placeholders)).toHaveLength(0)
  })

  it(`uses bearer token mapping when authMethod is bearer`, async () => {
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: {
            id: `p1`,
            brand: `amazon-bedrock`,
            secretId: `sec_1`,
            options: { region: `us-east-1`, authMethod: `bearer` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.CLAUDE_CODE_USE_BEDROCK).toBe(`1`)
    expect(result.extraEnv.AWS_BEARER_TOKEN_BEDROCK).toMatch(/^tdsk_ph_/)
    expect(result.extraEnv.AWS_ACCESS_KEY_ID).toBeUndefined()
    expect(result.extraEnv.AWS_SECRET_ACCESS_KEY).toBeUndefined()
  })

  it(`uses oauth token mapping when anthropic authMethod is oauth`, async () => {
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: {
            id: `p1`,
            brand: `anthropic`,
            secretId: `sec_1`,
            options: { authMethod: `oauth` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.CLAUDE_CODE_OAUTH_TOKEN).toMatch(/^tdsk_ph_/)
    expect(result.extraEnv.ANTHROPIC_API_KEY).toBeUndefined()
    expect(result.extraEnv.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(Object.keys(result.placeholders)).toHaveLength(1)
    expect(Object.values(result.placeholders)[0]).toEqual({
      secretId: `sec_1`,
      allowedDomains: [`api.anthropic.com`],
    })
    expect(result.errors).toEqual([])
  })

  it(`plain anthropic provider without authMethod still resolves ANTHROPIC_API_KEY`, async () => {
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: { id: `p1`, brand: `anthropic`, secretId: `sec_1`, options: {} },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.ANTHROPIC_API_KEY).toMatch(/^tdsk_ph_/)
    expect(result.extraEnv.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined()
    expect(Object.keys(result.placeholders)).toHaveLength(1)
    expect(result.errors).toEqual([])
  })

  it(`errors on missing required option`, async () => {
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: { id: `p1`, brand: `amazon-bedrock`, secretId: `sec_1`, options: {} },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors.some((e) => e.includes(`region`))).toBe(true)
  })

  it(`handles file injection for vertex credentials`, async () => {
    mockSecretResolver.resolveApiKey.mockResolvedValueOnce(`{"type":"service_account"}`)
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: {
            id: `p1`,
            brand: `google-vertex`,
            secretId: `sec_1`,
            options: { projectId: `my-project`, region: `us-east5` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.CLAUDE_CODE_USE_VERTEX).toBe(`1`)
    expect(result.extraEnv.ANTHROPIC_VERTEX_PROJECT_ID).toBe(`my-project`)
    expect(result.extraEnv.GOOGLE_APPLICATION_CREDENTIALS).toBe(`/tmp/gcloud-sa.json`)
    expect(result.extraEnv.TDSK_CRED_FILE_GOOGLE_APPLICATION_CREDENTIALS).toBeDefined()
    const decoded = Buffer.from(
      result.extraEnv.TDSK_CRED_FILE_GOOGLE_APPLICATION_CREDENTIALS,
      `base64`
    ).toString()
    expect(decoded).toBe(`{"type":"service_account"}`)
  })

  it(`injects model override from junction row for claude-code`, async () => {
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: { id: `p1`, brand: `anthropic`, secretId: `sec_1` },
          priority: 0,
          model: `claude-sonnet-4-6`,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.ANTHROPIC_MODEL).toBe(`claude-sonnet-4-6`)
  })

  it(`does not inject model override for non-claude-code runtime`, async () => {
    const result = await resolveProviderEnv(
      `codex`,
      [
        {
          provider: { id: `p1`, brand: `openai`, secretId: `sec_1` },
          priority: 0,
          model: `gpt-4`,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.ANTHROPIC_MODEL).toBeUndefined()
  })

  it(`skips unknown brand for runtime`, async () => {
    const result = await resolveProviderEnv(
      `codex`,
      [{ provider: { id: `p1`, brand: `anthropic`, secretId: `sec_1` }, priority: 0 }],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv).toEqual({})
  })

  it(`errors when provider has no secret for required env var`, async () => {
    const result = await resolveProviderEnv(
      `claude-code`,
      [{ provider: { id: `p1`, brand: `anthropic` }, priority: 0 }],
      mockSecretResolver,
      `org_1`
    )
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`ANTHROPIC_API_KEY`)
  })

  it(`injects static zai env vars`, async () => {
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: { id: `p1`, brand: `zai`, secretId: `sec_1`, options: {} },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.ANTHROPIC_BASE_URL).toBe(`https://api.z.ai/api/anthropic`)
    expect(result.extraEnv.API_TIMEOUT_MS).toBe(`3000000`)
    expect(result.extraEnv.ANTHROPIC_AUTH_TOKEN).toMatch(/^tdsk_ph_/)
  })

  it(`uses defaultValue for missing optional option`, async () => {
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: {
            id: `p1`,
            brand: `google-vertex`,
            secretId: `sec_1`,
            options: { projectId: `proj-1` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.CLOUD_ML_REGION).toBe(`global`)
  })

  it(`accumulates error when resolveApiKey returns null for direct injection`, async () => {
    mockSecretResolver.resolveApiKey.mockResolvedValue(null)
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: {
            id: `p1`,
            brand: `amazon-bedrock`,
            secretId: `sec_1`,
            options: { region: `us-east-1`, accessKeyId: `AKID123` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(
      result.errors.some((e) =>
        e.includes(`Failed to decrypt secret for AWS_SECRET_ACCESS_KEY`)
      )
    ).toBe(true)
  })

  it(`accumulates error when resolveApiKey throws for direct injection`, async () => {
    mockSecretResolver.resolveApiKey.mockRejectedValue(new Error(`decrypt failed`))
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: {
            id: `p1`,
            brand: `amazon-bedrock`,
            secretId: `sec_1`,
            options: { region: `us-east-1`, accessKeyId: `AKID123` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(
      result.errors.some((e) =>
        e.includes(`Secret resolution error for AWS_SECRET_ACCESS_KEY: decrypt failed`)
      )
    ).toBe(true)
  })

  it(`accumulates error when resolveApiKey returns null for file injection`, async () => {
    mockSecretResolver.resolveApiKey.mockResolvedValue(null)
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: {
            id: `p1`,
            brand: `google-vertex`,
            secretId: `sec_1`,
            options: { projectId: `my-project`, region: `us-east5` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(
      result.errors.some((e) =>
        e.includes(
          `Failed to decrypt secret for credential file GOOGLE_APPLICATION_CREDENTIALS`
        )
      )
    ).toBe(true)
  })

  it(`accumulates error when resolveApiKey throws for file injection`, async () => {
    mockSecretResolver.resolveApiKey.mockRejectedValue(new Error(`decrypt failed`))
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: {
            id: `p1`,
            brand: `google-vertex`,
            secretId: `sec_1`,
            options: { projectId: `my-project`, region: `us-east5` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(
      result.errors.some((e) =>
        e.includes(
          `Secret resolution error for credential file GOOGLE_APPLICATION_CREDENTIALS: decrypt failed`
        )
      )
    ).toBe(true)
  })

  it(`generates MITM placeholder for antigravity/google API key`, async () => {
    const result = await resolveProviderEnv(
      `antigravity`,
      [{ provider: { id: `p1`, brand: `google`, secretId: `sec_1` }, priority: 0 }],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.ANTIGRAVITY_API_KEY).toMatch(/^tdsk_ph_/)
    expect(Object.values(result.placeholders)[0]).toEqual({
      secretId: `sec_1`,
      allowedDomains: [`generativelanguage.googleapis.com`],
    })
    expect(result.errors).toEqual([])
  })

  it(`injects direct API key and Vertex config for antigravity/google-vertex`, async () => {
    mockSecretResolver.resolveApiKey.mockResolvedValueOnce(`direct-api-key`)
    mockSecretResolver.resolveApiKey.mockResolvedValueOnce(`{"type":"service_account"}`)
    const result = await resolveProviderEnv(
      `antigravity`,
      [
        {
          provider: {
            id: `p1`,
            brand: `google-vertex`,
            secretId: `sec_1`,
            options: { projectId: `my-proj`, region: `us-central1` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.ANTIGRAVITY_API_KEY).toBe(`direct-api-key`)
    expect(result.extraEnv.GOOGLE_GENAI_USE_VERTEXAI).toBe(`true`)
    expect(result.extraEnv.GOOGLE_CLOUD_PROJECT).toBe(`my-proj`)
    expect(result.extraEnv.GOOGLE_CLOUD_REGION).toBe(`us-central1`)
    expect(result.extraEnv.GOOGLE_APPLICATION_CREDENTIALS).toBe(`/tmp/gcloud-sa.json`)
    expect(result.errors).toEqual([])
  })

  it(`errors on antigravity/google with no secret`, async () => {
    const result = await resolveProviderEnv(
      `antigravity`,
      [{ provider: { id: `p1`, brand: `google` }, priority: 0 }],
      mockSecretResolver,
      `org_1`
    )
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`ANTIGRAVITY_API_KEY`)
  })

  it(`errors on antigravity/google-vertex with no secret for required ANTIGRAVITY_API_KEY`, async () => {
    const result = await resolveProviderEnv(
      `antigravity`,
      [
        {
          provider: {
            id: `p1`,
            brand: `google-vertex`,
            options: { projectId: `my-proj`, region: `us-central1` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`ANTIGRAVITY_API_KEY`)
  })

  it(`omits optional vertex options when not provided for antigravity`, async () => {
    mockSecretResolver.resolveApiKey.mockResolvedValueOnce(`direct-api-key`)
    const result = await resolveProviderEnv(
      `antigravity`,
      [
        {
          provider: {
            id: `p1`,
            brand: `google-vertex`,
            secretId: `sec_1`,
            options: {},
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.ANTIGRAVITY_API_KEY).toBe(`direct-api-key`)
    expect(result.extraEnv.GOOGLE_GENAI_USE_VERTEXAI).toBe(`true`)
    expect(result.extraEnv.GOOGLE_CLOUD_PROJECT).toBeUndefined()
    expect(result.extraEnv.GOOGLE_CLOUD_REGION).toBeUndefined()
    expect(result.errors).toEqual([])
  })

  it(`generates MITM placeholder for openclaw/anthropic API key`, async () => {
    const result = await resolveProviderEnv(
      `openclaw`,
      [{ provider: { id: `p1`, brand: `anthropic`, secretId: `sec_1` }, priority: 0 }],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.ANTHROPIC_API_KEY).toMatch(/^tdsk_ph_/)
    expect(Object.values(result.placeholders)[0]).toEqual({
      secretId: `sec_1`,
      allowedDomains: [`api.anthropic.com`],
    })
    expect(result.errors).toEqual([])
  })

  it(`generates MITM placeholder for openclaw/openai API key`, async () => {
    const result = await resolveProviderEnv(
      `openclaw`,
      [{ provider: { id: `p1`, brand: `openai`, secretId: `sec_1` }, priority: 0 }],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.OPENAI_API_KEY).toMatch(/^tdsk_ph_/)
    expect(Object.values(result.placeholders)[0]).toEqual({
      secretId: `sec_1`,
      allowedDomains: [`api.openai.com`],
    })
    expect(result.errors).toEqual([])
  })

  it(`generates MITM placeholder for openclaw/google API key`, async () => {
    const result = await resolveProviderEnv(
      `openclaw`,
      [{ provider: { id: `p1`, brand: `google`, secretId: `sec_1` }, priority: 0 }],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.GOOGLE_API_KEY).toMatch(/^tdsk_ph_/)
    expect(Object.values(result.placeholders)[0]).toEqual({
      secretId: `sec_1`,
      allowedDomains: [`generativelanguage.googleapis.com`],
    })
    expect(result.errors).toEqual([])
  })

  it(`generates MITM placeholder for openclaw/openrouter API key`, async () => {
    const result = await resolveProviderEnv(
      `openclaw`,
      [{ provider: { id: `p1`, brand: `openrouter`, secretId: `sec_1` }, priority: 0 }],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.OPENROUTER_API_KEY).toMatch(/^tdsk_ph_/)
    expect(Object.values(result.placeholders)[0]).toEqual({
      secretId: `sec_1`,
      allowedDomains: [`openrouter.ai`],
    })
    expect(result.errors).toEqual([])
  })

  it(`generates MITM placeholder for openclaw/ollamaCloud API key scoped to baseUrl host`, async () => {
    const result = await resolveProviderEnv(
      `openclaw`,
      [
        {
          provider: {
            id: `p1`,
            brand: `ollama:cloud`,
            secretId: `sec_1`,
            options: { baseUrl: `https://ollama.com` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.OLLAMA_API_KEY).toMatch(/^tdsk_ph_/)
    expect(Object.values(result.placeholders)[0]).toEqual({
      secretId: `sec_1`,
      allowedDomains: [`ollama.com`],
    })
    expect(result.errors).toEqual([])
  })

  it(`generates MITM placeholder for openclaw/custom API key scoped to baseUrl host`, async () => {
    const result = await resolveProviderEnv(
      `openclaw`,
      [
        {
          provider: {
            id: `p1`,
            brand: `custom`,
            secretId: `sec_1`,
            options: { baseUrl: `https://llm.example.com/v1` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.CUSTOM_API_KEY).toMatch(/^tdsk_ph_/)
    expect(Object.values(result.placeholders)[0]).toEqual({
      secretId: `sec_1`,
      allowedDomains: [`llm.example.com`],
    })
    expect(result.errors).toEqual([])
  })

  it(`errors and refuses placeholder for custom brand with no domain scope`, async () => {
    const result = await resolveProviderEnv(
      `openclaw`,
      [{ provider: { id: `p1`, brand: `custom`, secretId: `sec_1` }, priority: 0 }],
      mockSecretResolver,
      `org_1`
    )
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`no resolvable domain scope for CUSTOM_API_KEY`)
    expect(result.extraEnv.CUSTOM_API_KEY).toBeUndefined()
    expect(Object.keys(result.placeholders)).toHaveLength(0)
  })

  it(`errors and refuses placeholder when baseUrl is not a valid URL`, async () => {
    const result = await resolveProviderEnv(
      `openclaw`,
      [
        {
          provider: {
            id: `p1`,
            brand: `custom`,
            secretId: `sec_1`,
            options: { baseUrl: `not a url` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`no resolvable domain scope for CUSTOM_API_KEY`)
    expect(result.extraEnv.CUSTOM_API_KEY).toBeUndefined()
    expect(Object.keys(result.placeholders)).toHaveLength(0)
  })

  it(`errors on openclaw/anthropic with no secret`, async () => {
    const result = await resolveProviderEnv(
      `openclaw`,
      [{ provider: { id: `p1`, brand: `anthropic` }, priority: 0 }],
      mockSecretResolver,
      `org_1`
    )
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`ANTHROPIC_API_KEY`)
  })

  it(`generates MITM placeholder for codex/zai API key`, async () => {
    const result = await resolveProviderEnv(
      `codex`,
      [{ provider: { id: `p1`, brand: `zai`, secretId: `sec_1` }, priority: 0 }],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.Z_AI_API_KEY).toMatch(/^tdsk_ph_/)
    expect(Object.values(result.placeholders)[0]).toEqual({
      secretId: `sec_1`,
      allowedDomains: [`api.z.ai`],
    })
    expect(result.errors).toEqual([])
  })

  it(`maps ollama:cloud for codex when provider has secretId and baseUrl scope`, async () => {
    const result = await resolveProviderEnv(
      `codex`,
      [
        {
          provider: {
            id: `p1`,
            brand: `ollama`,
            secretId: `sec_1`,
            options: { baseUrl: `https://ollama.com` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.OLLAMA_API_KEY).toMatch(/^tdsk_ph_/)
    expect(Object.values(result.placeholders)[0]).toEqual({
      secretId: `sec_1`,
      allowedDomains: [`ollama.com`],
    })
    expect(result.errors).toEqual([])
  })

  it(`errors on ollama:cloud provider with no domain scope (brand default is empty)`, async () => {
    const result = await resolveProviderEnv(
      `codex`,
      [{ provider: { id: `p1`, brand: `ollama`, secretId: `sec_1` }, priority: 0 }],
      mockSecretResolver,
      `org_1`
    )
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`no resolvable domain scope for OLLAMA_API_KEY`)
    expect(result.extraEnv.OLLAMA_API_KEY).toBeUndefined()
    expect(Object.keys(result.placeholders)).toHaveLength(0)
  })

  it(`generates MITM placeholder for opencode/zai (ZHIPU_API_KEY)`, async () => {
    const result = await resolveProviderEnv(
      `opencode`,
      [{ provider: { id: `p1`, brand: `zai`, secretId: `sec_1` }, priority: 0 }],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.ZHIPU_API_KEY).toMatch(/^tdsk_ph_/)
    expect(Object.values(result.placeholders)[0]).toEqual({
      secretId: `sec_1`,
      allowedDomains: [`api.z.ai`],
    })
    expect(result.errors).toEqual([])
  })

  it(`maps ollama:cloud for opencode when provider has secretId and baseUrl scope`, async () => {
    const result = await resolveProviderEnv(
      `opencode`,
      [
        {
          provider: {
            id: `p1`,
            brand: `ollama`,
            secretId: `sec_1`,
            options: { baseUrl: `https://ollama.com` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.OLLAMA_API_KEY).toMatch(/^tdsk_ph_/)
    expect(Object.values(result.placeholders)[0]).toEqual({
      secretId: `sec_1`,
      allowedDomains: [`ollama.com`],
    })
    expect(result.errors).toEqual([])
  })

  it(`maps ollama:cloud for claude-code when provider has secretId and baseUrl scope`, async () => {
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: {
            id: `p1`,
            brand: `ollama`,
            secretId: `sec_1`,
            options: { baseUrl: `https://ollama.com` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    expect(result.extraEnv.ANTHROPIC_AUTH_TOKEN).toMatch(/^tdsk_ph_/)
    expect(result.extraEnv.ANTHROPIC_API_KEY).toBe(``)
    expect(result.extraEnv.ANTHROPIC_BASE_URL).toBe(`https://ollama.com`)
    expect(Object.values(result.placeholders)[0]).toEqual({
      secretId: `sec_1`,
      allowedDomains: [`ollama.com`],
    })
    expect(result.errors).toEqual([])
  })

  it(`includes allowedDomains in placeholder entry when provider has options.allowedDomains`, async () => {
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: {
            id: `p1`,
            brand: `anthropic`,
            secretId: `sec_1`,
            options: { allowedDomains: [`api.anthropic.com`, `*.claude.ai`] },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    const entry = Object.values(result.placeholders)[0]
    expect(entry).toEqual({
      secretId: `sec_1`,
      allowedDomains: [`api.anthropic.com`, `*.claude.ai`],
    })
  })

  it(`falls back to brand default domains when provider has no allowedDomains`, async () => {
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: { id: `p1`, brand: `anthropic`, secretId: `sec_1` },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    const entry = Object.values(result.placeholders)[0]
    expect(entry.secretId).toBe(`sec_1`)
    expect(entry.allowedDomains).toEqual([`api.anthropic.com`])
    expect(result.errors).toEqual([])
  })

  it(`prefers baseUrl-derived scope over brand default only when brand has no domains`, async () => {
    // anthropic has brand defaults, so baseUrl must NOT override them
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: {
            id: `p1`,
            brand: `anthropic`,
            secretId: `sec_1`,
            options: { baseUrl: `https://gateway.example.com` },
          },
          priority: 0,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    const entry = Object.values(result.placeholders)[0]
    expect(entry.allowedDomains).toEqual([`api.anthropic.com`])
  })

  it(`later provider overwrites env vars from earlier provider (last writer wins)`, async () => {
    mockSecretResolver.resolveApiKey.mockResolvedValue(`decrypted-api-key`)
    const result = await resolveProviderEnv(
      `claude-code`,
      [
        {
          provider: { id: `p1`, brand: `anthropic`, secretId: `sec_1` },
          priority: 0,
        },
        {
          provider: { id: `p2`, brand: `openrouter`, secretId: `sec_2` },
          priority: 1,
        },
      ],
      mockSecretResolver,
      `org_1`
    )
    // openrouter overwrites ANTHROPIC_API_KEY with empty static and sets ANTHROPIC_AUTH_TOKEN
    expect(result.extraEnv.ANTHROPIC_API_KEY).toBe(``)
    expect(result.extraEnv.ANTHROPIC_AUTH_TOKEN).toMatch(/^tdsk_ph_/)
    // The openrouter mapping also sets ANTHROPIC_BASE_URL as a static value
    expect(result.extraEnv.ANTHROPIC_BASE_URL).toBe(`https://openrouter.ai/api`)

    // The ANTHROPIC_AUTH_TOKEN placeholder should map to sec_2 (the openrouter provider's secret)
    const authTokenValue = result.extraEnv.ANTHROPIC_AUTH_TOKEN
    expect(result.placeholders[authTokenValue]).toEqual({
      secretId: `sec_2`,
      allowedDomains: [`openrouter.ai`],
    })
  })
})

describe(`resolveOneProviderEnv`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSecretResolver.resolveApiKey.mockResolvedValue(`decrypted-api-key`)
  })

  it(`resolves a single provider into its own env + domain-scoped placeholder`, async () => {
    const result = await resolveOneProviderEnv(
      `claude-code`,
      {
        priority: 1,
        provider: { id: `p1`, brand: `zai`, secretId: `sec_z`, options: {} },
      },
      mockSecretResolver,
      `org_1`
    )
    expect(result.brand).toBe(`zai`)
    expect(result.env.ANTHROPIC_AUTH_TOKEN).toMatch(/^tdsk_ph_/)
    expect(result.env.ANTHROPIC_BASE_URL).toBe(`https://api.z.ai/api/anthropic`)
    expect(Object.keys(result.placeholders)).toHaveLength(1)
    expect(result.placeholders[result.env.ANTHROPIC_AUTH_TOKEN]).toEqual({
      secretId: `sec_z`,
      allowedDomains: [`api.z.ai`],
    })
    expect(result.errors).toEqual([])
  })

  it(`fails closed when a mitm secret has no resolvable domain scope`, async () => {
    const result = await resolveOneProviderEnv(
      `openclaw`,
      { priority: 0, provider: { id: `p1`, brand: `custom`, secretId: `sec_1` } },
      mockSecretResolver,
      `org_1`
    )
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain(`no resolvable domain scope for CUSTOM_API_KEY`)
    expect(result.env.CUSTOM_API_KEY).toBeUndefined()
    expect(Object.keys(result.placeholders)).toHaveLength(0)
  })
})

describe(`resolveProviderEnvChain`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSecretResolver.resolveApiKey.mockResolvedValue(`decrypted-api-key`)
  })

  it(`builds a priority-ordered chain with isolated env sets and merged domain-scoped placeholders`, async () => {
    // Deliberately unsorted input — the chain must sort by priority ascending.
    const links = [
      { priority: 2, provider: { id: `p3`, brand: `openrouter`, secretId: `sec_or` } },
      {
        priority: 0,
        provider: {
          id: `p1`,
          brand: `anthropic`,
          secretId: `sec_anth`,
          options: { authMethod: `oauth` },
        },
      },
      {
        priority: 1,
        provider: { id: `p2`, brand: `zai`, secretId: `sec_zai`, options: {} },
      },
    ]
    const result = await resolveProviderEnvChain(
      `claude-code`,
      links,
      mockSecretResolver,
      `org_1`
    )

    // priority-0 is the primary (anthropic OAuth → CLAUDE_CODE_OAUTH_TOKEN)
    expect(result.primaryBrand).toBe(`anthropic`)
    expect(result.primaryEnv.CLAUDE_CODE_OAUTH_TOKEN).toMatch(/^tdsk_ph_/)
    expect(result.primaryEnv.ANTHROPIC_AUTH_TOKEN).toBeUndefined()

    // fallbacks in priority order, each with its OWN env set (no collision)
    expect(result.fallbacks).toHaveLength(2)
    expect(result.fallbacks[0].brand).toBe(`zai`)
    expect(result.fallbacks[0].env.ANTHROPIC_AUTH_TOKEN).toMatch(/^tdsk_ph_/)
    expect(result.fallbacks[0].env.ANTHROPIC_BASE_URL).toBe(
      `https://api.z.ai/api/anthropic`
    )
    expect(result.fallbacks[1].brand).toBe(`openrouter`)
    expect(result.fallbacks[1].env.ANTHROPIC_BASE_URL).toBe(`https://openrouter.ai/api`)

    // three distinct tokens, each domain-scoped to its own provider
    const tokens = Object.keys(result.placeholders)
    expect(tokens).toHaveLength(3)
    expect(
      result.placeholders[result.primaryEnv.CLAUDE_CODE_OAUTH_TOKEN].allowedDomains
    ).toEqual([`api.anthropic.com`])
    expect(
      result.placeholders[result.fallbacks[0].env.ANTHROPIC_AUTH_TOKEN].allowedDomains
    ).toEqual([`api.z.ai`])
    expect(
      result.placeholders[result.fallbacks[1].env.ANTHROPIC_AUTH_TOKEN].allowedDomains
    ).toEqual([`openrouter.ai`])

    // env sets are separate — the primary token differs from every fallback token
    expect(result.primaryEnv.CLAUDE_CODE_OAUTH_TOKEN).not.toBe(
      result.fallbacks[0].env.ANTHROPIC_AUTH_TOKEN
    )
    expect(result.fallbacks[0].env.ANTHROPIC_AUTH_TOKEN).not.toBe(
      result.fallbacks[1].env.ANTHROPIC_AUTH_TOKEN
    )
    expect(result.errors).toEqual([])
  })

  it(`returns an empty chain for no providers`, async () => {
    const result = await resolveProviderEnvChain(
      `claude-code`,
      [],
      mockSecretResolver,
      `org_1`
    )
    expect(result.primaryBrand).toBe(``)
    expect(result.primaryEnv).toEqual({})
    expect(result.fallbacks).toEqual([])
    expect(Object.keys(result.placeholders)).toHaveLength(0)
    expect(result.errors).toEqual([])
  })

  it(`collects a fail-closed error from a fallback provider without widening others`, async () => {
    const links = [
      {
        priority: 0,
        provider: {
          id: `p1`,
          brand: `anthropic`,
          secretId: `sec_anth`,
          options: { authMethod: `oauth` },
        },
      },
      // custom brand with a secret but no domain scope → fail closed
      { priority: 1, provider: { id: `p2`, brand: `custom`, secretId: `sec_x` } },
    ]
    const result = await resolveProviderEnvChain(
      `claude-code`,
      links,
      mockSecretResolver,
      `org_1`
    )
    expect(result.errors.some((e) => e.includes(`no resolvable domain scope`))).toBe(true)
    // The primary token stays scoped to anthropic only — never widened
    expect(
      result.placeholders[result.primaryEnv.CLAUDE_CODE_OAUTH_TOKEN].allowedDomains
    ).toEqual([`api.anthropic.com`])
  })
})
