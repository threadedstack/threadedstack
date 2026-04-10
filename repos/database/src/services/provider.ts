import type {
  TProviderBrand,
  TLLMProviderBrand,
  TProviderInput,
  TProviderType,
} from '@tdsk/domain'
import type { TServiceOpts, TDBProviderSelect, TDBProviderInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { isStr } from '@keg-hub/jsutils/isStr'
import { isArr } from '@keg-hub/jsutils/isArr'
import { providers } from '@TDB/schemas/providers'
import {
  Exception,
  EProvider,
  ELLMProviderBrand,
  Provider as ProviderModel,
} from '@tdsk/domain'

const validTypes = Object.values(EProvider) as string[]
const validLLMProviders = Object.values(ELLMProviderBrand) as string[]

type TResolveLLProvider = {
  name?: string | null
  brand?: TProviderBrand
}

export type TProviderValidate = {
  orgId: string
  inputs: unknown
  type?: TProviderType
}

export class Provider extends Base<
  typeof providers,
  TDBProviderSelect,
  TDBProviderInsert,
  ProviderModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: providers })
  }
  model = (data: TDBProviderSelect) => {
    return new ProviderModel(data as Partial<ProviderModel>)
  }

  validateType = (type?: string) => {
    if (!type)
      throw new Exception(
        400,
        `Provider type is required, must be one of: ${validTypes.join(`, `)}`
      )
    if (validTypes.includes(type)) return true
    throw new Exception(
      400,
      `Invalid provider type "${type}", must be one of: ${validTypes.join(`, `)}`
    )
  }

  /**
   * Validates that AI-type providers have brand set to a valid ELLMProviderBrand value.
   * Non-AI providers (git, auth, storage) are not validated.
   */
  validateLLM = (type?: string, brand?: string | null) => {
    if (type !== EProvider.ai) return

    if (!brand || !isStr(brand) || !validLLMProviders.includes(brand))
      throw new Exception(
        400,
        `AI providers require brand to be one of: ${validLLMProviders.join(`, `)}` +
          (brand ? `. Got: "${brand}"` : ``)
      )
  }

  /**
   * Resolves the LLM provider type from a provider record.
   *
   * Reads `provider.brand` which must be a valid ELLMProviderBrand value.
   * This is enforced at provider creation/update time by validateLLMProvider.
   */
  resolveLLMBrand = (provider: TResolveLLProvider): TLLMProviderBrand => {
    if (isStr(provider.brand) && validLLMProviders.includes(provider.brand))
      return provider.brand as TLLMProviderBrand

    const supported = validLLMProviders.join(`, `)
    throw new Exception(
      400,
      `Cannot determine LLM provider for "${provider.name || `unnamed`}". ` +
        `Set provider.brand to one of: ${supported}`
    )
  }

  /**
   * Validates and normalizes provider inputs for agent/sandbox endpoints.
   * Batch-fetches all providers in a single query, then validates:
   * - Each provider exists
   * - Each provider has type 'ai'
   * - Each provider belongs to the given org
   *
   * @param orgId - Organization ID for ownership check
   * @param type - Provider type tp validate against (EProvider)
   * @param inputs - Raw providerInputs from request body (may be any type)
   * @returns Validated TProviderInput array, or undefined if items is not an array
   */
  async validate(opts: TProviderValidate) {
    const { type, orgId, inputs } = opts

    if (!isArr(inputs)) return undefined

    const pins: TProviderInput[] = inputs.filter(
      (p: any): p is TProviderInput => isStr(p?.id) && !!p.id
    )

    if (!pins.length) return pins

    const { data: providers, error } = await this.db.services.provider.list({
      where: { id: pins.map((p) => p.id) },
    })

    if (error) throw new Exception(500, error.message)

    const providerMap = new Map((providers || []).map((p: any) => [p.id, p]))

    for (const pin of pins) {
      const provider = providerMap.get(pin.id)

      if (!provider) throw new Exception(404, `Provider ${pin.id} not found`)

      if (provider.orgId !== orgId)
        throw new Exception(
          403,
          `Provider ${pin.id} does not belong to organization ${orgId}`
        )

      if (type && provider.type !== type)
        throw new Exception(
          400,
          `Invalid ${provider.type} provider. Only ${type} providers are allowed`
        )
    }

    return pins
  }
}
