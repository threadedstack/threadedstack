import type { TAiProviderOption } from '@TAF/types/agent.types'

import { TextInput } from '@tdsk/components'
import { ProviderPriorityList } from './ProviderPriorityList'
import { FormSection } from '@TAF/components/FormSection/FormSection'

export type TBasicInfoFormProps = {
  name: string
  loading: boolean
  description: string
  providerIds: string[]
  providerModels: Record<string, string>
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  aiProviders: TAiProviderOption[]
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

      <ProviderPriorityList
        loading={loading}
        providerIds={providerIds}
        aiProviders={aiProviders}
        onChange={onProviderChange}
        onModelChange={onModelChange}
        providerModels={providerModels}
      />
    </FormSection>
  )
}
