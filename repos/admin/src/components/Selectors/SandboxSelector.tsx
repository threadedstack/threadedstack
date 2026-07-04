import { useMemo } from 'react'
import { EntitySelectorSingle } from '@TAF/components/Selectors/EntitySelector'

export type TSandboxSelector = {
  sandboxId: string
  loading?: boolean
  disabled?: boolean
  required?: boolean
  description?: string
  onChange: (sandboxId: string) => void
  sandboxes: Array<{ id: string; name: string }>
}

export const SandboxSelector = (props: TSandboxSelector) => {
  const { loading, disabled, required, description, onChange, sandboxId, sandboxes } =
    props

  const options = useMemo(
    () => sandboxes.map((s) => ({ id: s.id, label: s.name || s.id })),
    [sandboxes]
  )

  return (
    <EntitySelectorSingle
      id='sandbox-id'
      label='Sandbox'
      loading={loading}
      options={options}
      disabled={disabled}
      required={required}
      value={sandboxId || null}
      placeholder='Select sandbox...'
      onChange={(id) => onChange(id || '')}
      description={
        loading
          ? `Loading sandboxes...`
          : sandboxes.length === 0
            ? `No sandboxes available. Create a sandbox first.`
            : description || `Select the sandbox to run this schedule in`
      }
    />
  )
}
