import type { HTMLAttributes } from 'react'

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

export type TEntitySelectorOption = {
  id: string
  label: string
  secondary?: string
}

export type TEntitySelector = {
  id: string
  label: string
  title?: string
  description?: string
  placeholder?: string
  loading?: boolean
  disabled?: boolean
  multiple?: boolean
  value: string[]
  options: TEntitySelectorOption[]
  onChange: (ids: string[]) => void
}

export type TEntitySelectorSingle = Omit<
  TEntitySelector,
  'value' | 'onChange' | 'multiple'
> & {
  value: string | null
  onChange: (id: string | null) => void
}

type TOptionItem = HTMLAttributes<HTMLLIElement> & {
  key: any
  multiple: boolean
  option: TEntitySelectorOption
  selected: string[]
}

const OptionItem = (props: TOptionItem) => {
  const { option, selected, multiple, ...rest } = props

  if (multiple && selected.includes(option.id)) return null

  return (
    <li
      {...rest}
      key={option.id}
    >
      <Box>
        <Text
          variant='body2'
          sx={styles.item.label}
        >
          {option.label}
        </Text>
        {option.secondary && (
          <Text
            variant='caption'
            color='text.secondary'
          >
            {option.secondary}
          </Text>
        )}
      </Box>
    </li>
  )
}

const optionMap = (options: TEntitySelectorOption[]) => {
  const map = new Map<string, TEntitySelectorOption>()
  for (const opt of options) map.set(opt.id, opt)
  return map
}

export const EntitySelector = (props: TEntitySelector) => {
  const {
    id,
    label,
    title,
    value,
    options,
    loading,
    onChange,
    disabled,
    description,
    multiple = true,
    placeholder = `Select...`,
  } = props

  const lookup = optionMap(options)
  const optionIds = options.map((o) => o.id)
  const isDisabled = disabled || loading

  return (
    <Box>
      {title && (
        <Text
          variant='subtitle2'
          sx={styles.title}
        >
          {title}
        </Text>
      )}
      <InputStateHandler
        id={id}
        label={label}
        disabled={isDisabled}
        description={description}
      >
        <Autocomplete<string, boolean>
          id={id}
          multiple={multiple}
          disabled={isDisabled}
          className={cls(`tdsk-auto-input`, isDisabled && `disabled`)}
          value={(multiple ? value : value[0] || null) as any}
          options={optionIds}
          isOptionEqualToValue={(option, value) => option === value}
          getOptionLabel={(id) => lookup.get(id as string)?.label || (id as string)}
          onChange={(_, updates) => {
            const ids = Array.isArray(updates) ? updates : updates ? [updates] : []
            onChange(ids as string[])
          }}
          renderOption={(props, optionId) => {
            const opt = lookup.get(optionId as string)
            return opt ? (
              <OptionItem
                {...props}
                key={optionId as string}
                option={opt}
                selected={value}
                multiple={!!multiple}
              />
            ) : null
          }}
          renderInput={(params) => (
            <AutoInputText
              {...params}
              sx={styles.input}
              placeholder={placeholder}
            />
          )}
        />
      </InputStateHandler>
    </Box>
  )
}

export const EntitySelectorSingle = (props: TEntitySelectorSingle) => {
  const { value, onChange, ...rest } = props

  return (
    <EntitySelector
      {...rest}
      multiple={false}
      value={value ? [value] : []}
      onChange={(ids) => onChange(ids[0] || null)}
    />
  )
}
