import type { HTMLAttributes } from 'react'
import type { Function as FunctionModel } from '@tdsk/domain'

import Box from '@mui/material/Box'
import { cls } from '@keg-hub/jsutils/cls'
import Autocomplete from '@mui/material/Autocomplete'
import { Text, AutoInputText, InputStateHandler } from '@tdsk/components'

const styles = {
  input: { padding: `0px` },
  title: { fontWeight: 600, mb: 2 },
  item: {
    label: { fontWeight: `medium` },
  },
}

export type TFunctionsSelector = {
  loading: boolean
  selectedFunctionIds: string[]
  availableFunctions: FunctionModel[]
  onChange: (functionIds: string[]) => void
}

type TFunctionItem = HTMLAttributes<HTMLLIElement> & {
  key: any
  option: string
  selected?: string[]
  functions: FunctionModel[]
}

const FunctionItem = (props: TFunctionItem) => {
  const { option, selected, functions, ...rest } = props
  const fn = functions.find((f) => f.id === option)

  return !selected.includes(option) ? (
    <li
      {...rest}
      key={option}
    >
      <Box>
        <Text
          variant='body2'
          sx={styles.item.label}
        >
          {fn?.name || option}
        </Text>
        <Text
          variant='caption'
          color='text.secondary'
        >
          {fn?.description}
        </Text>
      </Box>
    </li>
  ) : null
}

export const FunctionsSelector = (props: TFunctionsSelector) => {
  const { loading, onChange, selectedFunctionIds, availableFunctions } = props

  return (
    <Box>
      <Text
        variant='subtitle2'
        sx={styles.title}
      >
        Custom Functions
      </Text>
      <InputStateHandler
        id='agent-functions'
        label='Custom Functions'
        disabled={loading || availableFunctions.length === 0}
        description={
          loading
            ? `Loading functions...`
            : availableFunctions.length === 0
              ? `No functions available. Create a function first.`
              : `Select functions to attach as tools for this agent`
        }
      >
        <Autocomplete
          multiple
          id='agent-functions'
          className={cls(`tdsk-auto-input`, loading && `disabled`)}
          value={selectedFunctionIds}
          options={availableFunctions.map((f) => f.id)}
          getOptionLabel={(id) => availableFunctions.find((f) => f.id === id)?.name || id}
          onChange={(_, updates) => onChange(updates)}
          disabled={loading || availableFunctions.length === 0}
          renderOption={(props, option) => (
            <FunctionItem
              {...props}
              key={option}
              option={option}
              selected={selectedFunctionIds}
              functions={availableFunctions}
            />
          )}
          renderInput={(params) => (
            <AutoInputText
              {...params}
              sx={styles.input}
              placeholder='Select functions...'
            />
          )}
        />
      </InputStateHandler>
    </Box>
  )
}
