import { SwitchInput } from '@tdsk/components'
import { FormSection } from '@TAF/components/FormSection/FormSection'

export type TAgentSettingsFormProps = {
  active: boolean
  loading: boolean
  streaming: boolean
  autonomous?: boolean
  onActiveChange: (value: boolean) => void
  onStreamingChange: (value: boolean) => void
  onAutonomousChange?: (value: boolean) => void
}

export const AgentSettingsForm = (props: TAgentSettingsFormProps) => {
  const {
    active,
    loading,
    streaming,
    autonomous,
    onActiveChange,
    onStreamingChange,
    onAutonomousChange,
  } = props

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

      {onAutonomousChange && (
        <SwitchInput
          label='Autonomous'
          disabled={loading}
          id='agent-autonomous'
          checked={autonomous ?? false}
          onChange={(e, checked) => onAutonomousChange(checked)}
        />
      )}
    </FormSection>
  )
}
