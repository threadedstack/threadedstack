import { useMemo } from 'react'
import { EntitySelector, EntitySelectorSingle } from './EntitySelector'

export type TProviderSelector = {
  loading?: boolean
  disabled?: boolean
  required?: boolean
  selectedProviderIds: string[]
  onChange: (providerIds: string[]) => void
  providers: Array<{ id: string; name: string }>
}

export type TProviderSelectorSingle = {
  loading?: boolean
  disabled?: boolean
  required?: boolean
  providerId: string
  onChange: (providerId: string) => void
  providers: Array<{ id: string; name: string }>
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
  const { loading, disabled, providers, required, selectedProviderIds, onChange } = props
  const options = useProviderOptions(providers)

  return (
    <EntitySelector
      loading={loading}
      options={options}
      required={required}
      onChange={onChange}
      title='AI Providers'
      label='AI Providers'
      id='entity-providers'
      value={selectedProviderIds}
      placeholder='Select providers...'
      disabled={disabled || providers.length === 0}
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
  const { loading, disabled, providers, providerId, required, onChange } = props
  const options = useProviderOptions(providers)

  return (
    <EntitySelectorSingle
      loading={loading}
      options={options}
      disabled={disabled}
      label='AI Provider'
      id='entity-provider'
      required={required}
      value={providerId || null}
      placeholder='Select provider...'
      onChange={(id) => onChange(id || '')}
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
