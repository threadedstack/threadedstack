import { SwitchInput } from '@tdsk/components'
import { FormSection } from '@TAF/components/FormSection/FormSection'

export type TAgentSettingsFormProps = {
  active: boolean
  loading: boolean
  streaming: boolean
  onActiveChange: (value: boolean) => void
  onStreamingChange: (value: boolean) => void
}

export const AgentSettingsForm = (props: TAgentSettingsFormProps) => {
  const { active, loading, streaming, onActiveChange, onStreamingChange } = props

  return (
    <FormSection title='Agent Settings'>
      <SwitchInput
        id='agent-streaming'
        disabled={loading}
        checked={streaming}
        label='Enable Streaming'
        onChange={(e, checked) => onStreamingChange(checked)}
      />

      <SwitchInput
        label='Active'
        checked={active}
        id='agent-active'
        disabled={loading}
        onChange={(e, checked) => onActiveChange(checked)}
      />
    </FormSection>
  )
}
