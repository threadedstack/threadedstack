import type { TLLMProviderBrand } from '@tdsk/domain'

export type TProviderInfo = {
  id: string
  name: string
  model: string
  provider: TLLMProviderBrand
}

export type TConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'
