import type { HTMLAttributes } from 'react'

import Box from '@mui/material/Box'
import { cls } from '@keg-hub/jsutils/cls'
import { AvailableTools } from '@TAF/constants/tools'
import Autocomplete from '@mui/material/Autocomplete'
import { Text, AutoInputText, InputStateHandler } from '@tdsk/components'

const styles = {
  input: { padding: `0px` },
  title: { fontWeight: 600, mb: 2 },
  item: {
    label: { fontWeight: `medium` },
  },
}

export type TToolsSelector = {
  loading: boolean
  selectedTools: string[]
  onChange: (tools: string[]) => void
}

type TToolItem = HTMLAttributes<HTMLLIElement> & {
  key: any
  option: string
  selected?: string[]
}

const ToolOptions = AvailableTools.map((t) => t.value)
const toolLabel = (option: string) => {
  const tool = AvailableTools.find((t) => t.value === option)
  return tool ? tool.label : option
}

const ToolItem = (props: TToolItem) => {
  const { option, selected, ...rest } = props
  const tool = AvailableTools.find((t) => t.value === option)

  return !selected.includes(tool.value) ? (
    <li
      {...rest}
      key={option}
    >
      <Box>
        <Text
          variant='body2'
          sx={styles.item.label}
        >
          {tool?.label}
        </Text>
        <Text
          variant='caption'
          color='text.secondary'
        >
          {tool?.description}
        </Text>
      </Box>
    </li>
  ) : null
}

export const ToolsSelector = (props: TToolsSelector) => {
  const { loading, onChange, selectedTools } = props

  return (
    <Box>
      <Text
        variant='subtitle2'
        sx={styles.title}
      >
        Available Tools
      </Text>
      <InputStateHandler
        id='agent-tools'
        disabled={loading}
        label='Selected Tools'
        description='Choose which tools this agent access to when running'
      >
        <Autocomplete
          multiple
          id='agent-tools'
          className={cls(`tdsk-auto-input`, loading && `disabled`)}
          value={selectedTools}
          options={ToolOptions}
          getOptionLabel={toolLabel}
          onChange={(_, updates) => onChange(updates)}
          renderOption={(props, option) => (
            <ToolItem
              {...props}
              key={option}
              option={option}
              selected={selectedTools}
            />
          )}
          renderInput={(params) => (
            <AutoInputText
              {...params}
              sx={styles.input}
              placeholder='Tools...'
            />
          )}
        />
      </InputStateHandler>
    </Box>
  )
}
