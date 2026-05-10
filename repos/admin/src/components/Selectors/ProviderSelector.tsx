import { useMemo } from 'react'
import { EntitySelector, EntitySelectorSingle } from './EntitySelector'
import {
  DefProviderLabel,
  DefProvidersLabel,
  ProviderTypeLabels,
} from '@TAF/constants/providers'

export type TProviderSelector = {
  type?: string
  loading?: boolean
  disabled?: boolean
  required?: boolean
  selectedProviderIds: string[]
  onChange: (providerIds: string[]) => void
  providers: Array<{ id: string; name: string }>
}

export type TProviderSelectorSingle = {
  type?: string
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
  const { type, loading, disabled, required, onChange, providers, selectedProviderIds } =
    props

  const options = useProviderOptions(providers)
  const labels = ProviderTypeLabels[type || `ai`] || DefProvidersLabel

  return (
    <EntitySelector
      loading={loading}
      options={options}
      required={required}
      onChange={onChange}
      title={labels.title}
      label={labels.label}
      id='entity-providers'
      value={selectedProviderIds}
      placeholder='Select providers...'
      disabled={disabled || providers.length === 0}
      description={
        loading
          ? 'Loading providers...'
          : providers.length === 0
            ? labels.empty
            : labels.desc
      }
    />
  )
}

export const ProviderSelectorSingle = (props: TProviderSelectorSingle) => {
  const { type, loading, disabled, required, onChange, providers, providerId } = props

  const options = useProviderOptions(providers)
  const labels = ProviderTypeLabels[type || `ai`] || DefProviderLabel

  return (
    <EntitySelectorSingle
      loading={loading}
      options={options}
      disabled={disabled}
      label={labels.label}
      id='entity-provider'
      required={required}
      value={providerId || null}
      placeholder='Select provider...'
      onChange={(id) => onChange(id || '')}
      description={
        loading
          ? 'Loading providers...'
          : providers.length === 0
            ? labels.empty
            : labels.desc
      }
    />
  )
}
