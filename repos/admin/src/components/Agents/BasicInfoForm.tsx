import type { TProviderLinkItem, TAiProviderOption } from '@TAF/types'

import { useMemo } from 'react'
import { TextInput, InputStateHandler } from '@tdsk/components'
import { FormSection } from '@TAF/components/FormSection/FormSection'
import { ProviderLinkList } from '@TAF/components/Providers/ProviderLinkList'

export type TBasicInfoFormProps = {
  name: string
  loading: boolean
  description: string
  providerIds: string[]
  aiProviders: TAiProviderOption[]
  providerModels: Record<string, string>
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onProviderChange: (providerIds: string[]) => void
  onModelChange: (models: Record<string, string>) => void
}

export const BasicInfoForm = (props: TBasicInfoFormProps) => {
  const {
    name,
    loading,
    providerIds,
    aiProviders,
    description,
    onNameChange,
    onModelChange,
    providerModels,
    onProviderChange,
    onDescriptionChange,
  } = props

  const providers = useMemo<TProviderLinkItem[]>(
    () =>
      providerIds
        .map((id) => {
          const ap = aiProviders.find((p) => p.id === id)
          return !ap
            ? null
            : {
                id,
                name: ap.name,
                brand: ap.brand,
                model: providerModels[id] ?? null,
              }
        })
        .filter(Boolean) as TProviderLinkItem[],
    [providerIds, aiProviders, providerModels]
  )

  const availableProviders = useMemo<TProviderLinkItem[]>(
    () =>
      aiProviders
        .filter((p) => !providerIds.includes(p.id))
        .map((p) => ({ id: p.id, name: p.name, brand: p.brand })),
    [aiProviders, providerIds]
  )

  const description_ = loading
    ? 'Loading providers...'
    : aiProviders.length === 0
      ? 'No AI providers available. Create a provider first.'
      : 'Order determines priority. First provider is primary.'

  return (
    <FormSection title='Basic Information'>
      <TextInput
        autoFocus
        required
        fullWidth
        value={name}
        id='agent-name'
        disabled={loading}
        label='Agent Name'
        placeholder='e.g., Customer Support Bot'
        onChange={(e) => onNameChange(e.target.value)}
      />

      <TextInput
        textarea
        fullWidth
        minRows={2}
        disabled={loading}
        value={description}
        label='Description'
        id='agent-description'
        placeholder='Describe what this agent does...'
        onChange={(e) => onDescriptionChange(e.target.value)}
      />

      <InputStateHandler
        id='agent-providers'
        disabled={loading}
        label='AI Providers'
        description={description_}
      >
        <ProviderLinkList
          reorderable
          loading={loading}
          providers={providers}
          availableProviders={availableProviders}
          onAdd={(p) => onProviderChange([...providerIds, p.id])}
          onReorder={(items) => onProviderChange(items.map((p) => p.id))}
          onModelChange={(id, model) => onModelChange({ ...providerModels, [id]: model })}
          onRemove={(id) => {
            onProviderChange(providerIds.filter((x) => x !== id))
            if (!providerModels[id]) return

            const updated = { ...providerModels }
            delete updated[id]
            onModelChange(updated)
          }}
        />
      </InputStateHandler>
    </FormSection>
  )
}
