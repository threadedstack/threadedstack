import type { Provider } from '@tdsk/domain'
import type { TDatabase } from '@tdsk/database'
import type { TApp, TEmbedOpts } from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { SecretResolver } from '@TBE/services/secrets/secretResolver'
import {
  EProvider,
  EAIProviderBrand,
  AIProviderTemplates,
  MemoryMaxTextChars,
  MemoryEmbeddingDimensions,
} from '@tdsk/domain'

/**
 * Resolve the org's embedding provider: the FIRST org `ai` provider whose
 * `options.embeddingModel` is a non-empty string, in deterministic createdAt
 * order (oldest first). Returns null when no provider opts in — the caller
 * then runs lexical-only (embeddings stay NULL).
 */
export const resolveEmbeddingProvider = async (
  db: TDatabase,
  orgId: string
): Promise<Provider | null> => {
  const { data: providers, error } = await db.services.provider.list({ where: { orgId } })
  if (error) {
    logger.warn(
      `[EmbeddingService] Failed to list providers for org ${orgId}: ${error.message}`
    )
    return null
  }

  const candidates = (providers || [])
    .filter((provider) => {
      const model = provider.options?.embeddingModel
      return (
        provider.type === EProvider.ai &&
        typeof model === `string` &&
        model.trim().length > 0
      )
    })
    .sort(
      (a, b) =>
        new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
    )

  return candidates[0] ?? null
}

/**
 * EmbeddingService
 *
 * Resolves an org's embedding provider (explicit opt-in via
 * `options.embeddingModel`) and its decrypted API key, then calls the provider's
 * embeddings API. Supports the OpenAI-compatible `/embeddings` shape (default)
 * and Google `:batchEmbedContents`. Every failure mode — no provider, no key,
 * network/HTTP error, malformed response — degrades to a same-length array of
 * nulls (NEVER throws). A null embedding means "lexical-only" for that row.
 */
export class EmbeddingService {
  #app: TApp

  constructor(app: TApp) {
    this.#app = app
  }

  static init = (app: TApp): EmbeddingService => new EmbeddingService(app)

  /**
   * Embed a batch of texts, returning one vector (or null) per input in order.
   * Each input is truncated to MemoryMaxTextChars before embedding.
   */
  embed = async (texts: string[], opts: TEmbedOpts): Promise<(number[] | null)[]> => {
    if (!texts.length) return []
    const nulls: (number[] | null)[] = texts.map(() => null)

    const { db } = this.#app.locals
    const provider = await resolveEmbeddingProvider(db, opts.orgId)
    if (!provider) {
      logger.debug(
        `[EmbeddingService] No embedding provider for org ${opts.orgId} — lexical-only`
      )
      return nulls
    }

    const model = (provider.options?.embeddingModel as string | undefined)?.trim()
    if (!model) return nulls

    // A key is optional: self-hosted providers (the in-cluster TEI service) run
    // without auth, so an empty key is valid and simply means "send no auth header".
    // External providers that DO need a key get a 401, which the outer catch turns
    // into the same null (lexical) degradation.
    let apiKey = ``
    try {
      apiKey = await new SecretResolver(db).resolveApiKey({ orgId: opts.orgId }, provider)
    } catch (err) {
      logger.warn(
        `[EmbeddingService] Failed to resolve API key for provider ${provider.id}: ${
          (err as Error).message
        }`
      )
      return nulls
    }

    const inputs = texts.map((text) =>
      text.length > MemoryMaxTextChars ? text.slice(0, MemoryMaxTextChars) : text
    )
    const baseUrl = (
      (provider.options?.baseUrl as string | undefined) ||
      AIProviderTemplates[provider.brand as EAIProviderBrand]?.baseUrl ||
      ``
    ).replace(/\/+$/, ``)

    // `dimensions` is only meaningful for models that support output-dimension
    // reduction (e.g. OpenAI text-embedding-3-*). Native-dim models such as the
    // self-hosted TEI `bge-large-en-v1.5` (1024) reject an unexpected `dimensions`
    // field, so it is sent ONLY when a provider explicitly opts in via
    // `options.embeddingDimensions`. When omitted, the model's native dimension is
    // used and MUST equal MemoryEmbeddingDimensions (enforced by the vector column).
    const embDims =
      typeof provider.options?.embeddingDimensions === `number`
        ? provider.options.embeddingDimensions
        : undefined

    try {
      return provider.brand === EAIProviderBrand.google
        ? await this.#embedGoogle(baseUrl, apiKey, model, inputs)
        : await this.#embedOpenAI(baseUrl, apiKey, model, inputs, embDims)
    } catch (err) {
      logger.warn(
        `[EmbeddingService] Embedding request failed for provider ${provider.id}: ${
          (err as Error).message
        }`
      )
      return nulls
    }
  }

  /** Single-text convenience — returns the vector or null. */
  embedOne = async (text: string, opts: TEmbedOpts): Promise<number[] | null> => {
    const [vector] = await this.embed([text], opts)
    return vector ?? null
  }

  /**
   * OpenAI-compatible embeddings: POST {baseUrl}/embeddings.
   * `dimensions` is sent only when provided (see `embed`) — models that support
   * output-dimension reduction (OpenAI text-embedding-3-*) use it; native-dim
   * models (the self-hosted TEI `bge-large-en-v1.5`, 1024) omit it and return
   * their native dimension, which must equal MemoryEmbeddingDimensions.
   */
  #embedOpenAI = async (
    baseUrl: string,
    apiKey: string,
    model: string,
    inputs: string[],
    dimensions?: number
  ): Promise<(number[] | null)[]> => {
    const res = await fetch(`${baseUrl}/embeddings`, {
      method: `POST`,
      headers: {
        'content-type': `application/json`,
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        input: inputs,
        ...(dimensions !== undefined ? { dimensions } : {}),
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => ``)
      throw new Error(`OpenAI embeddings ${res.status}: ${body.slice(0, 200)}`)
    }

    const json = (await res.json()) as {
      data?: Array<{ index?: number; embedding?: number[] }>
    }
    const out: (number[] | null)[] = inputs.map(() => null)
    for (const item of json?.data ?? []) {
      const idx = typeof item?.index === `number` ? item.index : -1
      if (idx >= 0 && idx < out.length && Array.isArray(item?.embedding))
        out[idx] = item.embedding
    }
    return out
  }

  /**
   * Google embeddings: POST {baseUrl}/models/{model}:batchEmbedContents.
   * `outputDimensionality` pins vectors to MemoryEmbeddingDimensions.
   */
  #embedGoogle = async (
    baseUrl: string,
    apiKey: string,
    model: string,
    inputs: string[]
  ): Promise<(number[] | null)[]> => {
    const qualifiedModel = model.startsWith(`models/`) ? model : `models/${model}`
    const urlModel = qualifiedModel.replace(/^models\//, ``)

    const res = await fetch(`${baseUrl}/models/${urlModel}:batchEmbedContents`, {
      method: `POST`,
      headers: {
        'content-type': `application/json`,
        ...(apiKey ? { 'x-goog-api-key': apiKey } : {}),
      },
      body: JSON.stringify({
        requests: inputs.map((text) => ({
          model: qualifiedModel,
          content: { parts: [{ text }] },
          outputDimensionality: MemoryEmbeddingDimensions,
        })),
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => ``)
      throw new Error(`Google embeddings ${res.status}: ${body.slice(0, 200)}`)
    }

    const json = (await res.json()) as { embeddings?: Array<{ values?: number[] }> }
    const embeddings = json?.embeddings ?? []
    return inputs.map((_, i) => {
      const values = embeddings[i]?.values
      return Array.isArray(values) ? values : null
    })
  }
}
