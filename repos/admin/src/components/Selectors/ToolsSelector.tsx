import { AvailableTools } from '@TAF/constants/tools'
import { EntitySelector } from './EntitySelector'

export type TToolsSelector = {
  loading: boolean
  selectedTools: string[]
  onChange: (tools: string[]) => void
}

const toolOptions = AvailableTools.map((t) => ({
  id: t.value,
  label: t.label,
  secondary: t.description,
}))

export const ToolsSelector = (props: TToolsSelector) => {
  const { loading, onChange, selectedTools } = props

  return (
    <EntitySelector
      id='agent-tools'
      title='Available Tools'
      label='Selected Tools'
      loading={loading}
      value={selectedTools}
      options={toolOptions}
      onChange={onChange}
      placeholder='Tools...'
      description='Choose which tools this agent access to when running'
    />
  )
}
