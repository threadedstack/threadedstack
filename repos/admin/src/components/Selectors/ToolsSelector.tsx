import { AvailableTools } from '@TAF/constants/tools'
import { EntitySelector } from './EntitySelector'

export type TToolsSelector = {
  loading: boolean
  required?: boolean
  selectedTools: string[]
  onChange: (tools: string[]) => void
}

const toolOptions = AvailableTools.map((t) => ({
  id: t.value,
  label: t.label,
  secondary: t.description,
}))

export const ToolsSelector = (props: TToolsSelector) => {
  const { loading, onChange, required, selectedTools } = props

  return (
    <EntitySelector
      id='agent-tools'
      loading={loading}
      onChange={onChange}
      required={required}
      options={toolOptions}
      value={selectedTools}
      label='Selected Tools'
      title='Available Tools'
      placeholder='Tools...'
      description='Choose which tools this agent access to when running'
    />
  )
}
