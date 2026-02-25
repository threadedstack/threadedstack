import { useMemo } from 'react'
import { EntitySelector, EntitySelectorSingle } from './EntitySelector'

export type TProviderSelector = {
  loading?: boolean
  disabled?: boolean
  providers: Array<{ id: string; name: string }>
  selectedProviderIds: string[]
  onChange: (providerIds: string[]) => void
}

export type TProviderSelectorSingle = {
  loading?: boolean
  disabled?: boolean
  providers: Array<{ id: string; name: string }>
  providerId: string
  onChange: (providerId: string) => void
}

const useProviderOptions = (providers: TProviderSelector['providers']) =>
  useMemo(
    () =>
      providers.map((p) => ({
        id: p.id,
        label: p.name || p.id,
      })),
    [providers]
  )

export const ProviderSelector = (props: TProviderSelector) => {
  const { loading, disabled, providers, selectedProviderIds, onChange } = props
  const options = useProviderOptions(providers)

  return (
    <EntitySelector
      id='entity-providers'
      title='AI Providers'
      label='AI Providers'
      loading={loading}
      disabled={disabled || providers.length === 0}
      value={selectedProviderIds}
      options={options}
      onChange={onChange}
      placeholder='Select providers...'
      description={
        loading
          ? 'Loading providers...'
          : providers.length === 0
            ? 'No AI providers available. Create a provider first.'
            : 'Select AI providers for this entity'
      }
    />
  )
}

export const ProviderSelectorSingle = (props: TProviderSelectorSingle) => {
  const { loading, disabled, providers, providerId, onChange } = props
  const options = useProviderOptions(providers)

  return (
    <EntitySelectorSingle
      id='entity-provider'
      label='AI Provider'
      loading={loading}
      disabled={disabled}
      value={providerId || null}
      options={options}
      onChange={(id) => onChange(id || '')}
      placeholder='Select provider...'
      description={
        loading
          ? 'Loading providers...'
          : providers.length === 0
            ? 'No AI providers available.'
            : 'Select an AI provider'
      }
    />
  )
}
