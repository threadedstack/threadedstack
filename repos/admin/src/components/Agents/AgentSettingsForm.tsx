import { EAgentBrain } from '@tdsk/domain'
import { SwitchInput, SelectInput } from '@tdsk/components'
import { SandboxSelector } from '@TAF/components/Selectors/SandboxSelector'
import { FormSection } from '@TAF/components/FormSection/FormSection'

export type TAgentSettingsFormProps = {
  active: boolean
  loading: boolean
  streaming: boolean
  autonomous?: boolean
  brain?: EAgentBrain
  sandboxId?: string
  sandboxLoading?: boolean
  sandboxes?: Array<{ id: string; name: string }>
  onActiveChange: (value: boolean) => void
  onStreamingChange: (value: boolean) => void
  onAutonomousChange?: (value: boolean) => void
  onBrainChange?: (value: EAgentBrain) => void
  onSandboxChange?: (value: string) => void
}

const BrainOptions = [
  { value: EAgentBrain.api, label: `API (built-in runner)` },
  { value: EAgentBrain.runtime, label: `Sandbox runtime (CLI tool)` },
]

const BrainHelperText: Record<EAgentBrain, string> = {
  [EAgentBrain.api]: `Calls LLM provider APIs directly via the built-in runner.`,
  [EAgentBrain.runtime]: `Runs the body sandbox's AI tool; requires a sandbox in Environment and credentials via the sandbox's providers.`,
}

export const AgentSettingsForm = (props: TAgentSettingsFormProps) => {
  const {
    active,
    brain,
    loading,
    streaming,
    sandboxId,
    autonomous,
    sandboxes,
    sandboxLoading,
    onBrainChange,
    onActiveChange,
    onSandboxChange,
    onStreamingChange,
    onAutonomousChange,
  } = props

  const brainValue = brain ?? EAgentBrain.api

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

      {onBrainChange && (
        <SelectInput
          label='Brain'
          id='agent-brain'
          disabled={loading}
          value={brainValue}
          items={BrainOptions}
          helperText={BrainHelperText[brainValue]}
          onChange={(e) => onBrainChange(e.target.value as EAgentBrain)}
        />
      )}

      {brainValue === EAgentBrain.runtime && onSandboxChange && (
        <SandboxSelector
          sandboxId={sandboxId || ``}
          sandboxes={sandboxes || []}
          onChange={onSandboxChange}
          loading={sandboxLoading}
          disabled={loading}
          description={`Select the body sandbox that runs this agent's runtime brain`}
        />
      )}
    </FormSection>
  )
}
