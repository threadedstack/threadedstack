import type { SxProps } from '@mui/material'
import type { IInput, TSelectItem } from '@TSC/types'
import type { CSSProperties, MouseEvent } from 'react'
import type { SelectChangeEvent, SelectProps } from '@mui/material/Select'

import {
  InlineSelectContainer,
  InlineSelectItem,
} from '@TSC/components/Inputs/InlineSelect.styles'
import { InputStateHandler } from '@TSC/components/Inputs/InputStateHandler'
import { SelectInputValue } from '@TSC/components/Inputs/SelectInputValue'
import { useIsDarkMode } from '@TSC/hooks/theme/useIsDarkMode'
import { stopEvent } from '@TSC/utils/helpers'
import { cls } from '@keg-hub/jsutils/cls'
import { ensureArr } from '@keg-hub/jsutils/ensureArr'

import { wordCaps } from '@keg-hub/jsutils/wordCaps'

export type TInlineSelect = IInput &
  Omit<SelectProps<string>, `value` | `onChange`> & {
    name?: string
    inline?: boolean
    iconSx?: SxProps
    capitalize?: boolean
    showAmount?: number
    placeholder?: string
    items?: TSelectItem[]
    value?: string | number
    selectSx?: CSSProperties
    children?: React.ReactNode
    renderLabel?: () => string
    itemMap?: Record<string, any>
    selected?: Array<string | number | boolean>
    onChange: (e: SelectChangeEvent) => void
    setField?(field: string, value: string[], shouldValidate?: boolean): void
    onItemMouseEnter?: (e: MouseEvent<HTMLLIElement>, itemName: string) => void
    onItemMouseLeave?: (e: MouseEvent<HTMLLIElement>) => void
  }

export const InlineSelect = (props: TInlineSelect) => {
  const {
    id,
    sx,
    label,
    items,
    value,
    hidden,
    tooltip,
    itemMap,
    hasError,
    setField,
    children,
    required,
    className,
    capitalize,
    helperText,
    showAmount = 3,
    disabled = false,
    description = helperText,
  } = props

  const isDarkMode = useIsDarkMode()

  const onChange = (evt: any, item: TSelectItem) => {
    stopEvent(evt)

    const val = item.value
    let updated = [...ensureArr(value)]
    if (updated.includes(val)) updated = updated.filter((item) => item !== val)
    else updated.push(item.value)

    setField?.(id, updated, false)
  }

  return (
    <InputStateHandler
      id={id}
      sx={sx}
      label={label}
      hidden={hidden}
      tooltip={tooltip}
      required={required}
      disabled={disabled}
      hasError={hasError}
      className={className}
      description={description}
    >
      <InlineSelectContainer
        height={showAmount}
        className={cls(hidden && `hidden`, `tdsk-inline-select-container`)}
      >
        {children ||
          items?.map((item) => {
            const selected = (value as any)?.includes?.(item.value)

            const data = itemMap[item?.value] || item
            let display = `${data?.label || item?.value}`
            display = capitalize ? wordCaps(display) : display

            return (
              <InlineSelectItem
                key={item.value}
                onClick={(evt: any) => onChange(evt, item)}
                className={cls(
                  hidden && `hidden`,
                  selected && `selected`,
                  disabled && `disabled`,
                  required && `required`,
                  `tdsk-inline-select-item`
                )}
              >
                <SelectInputValue
                  bold
                  multiple
                  checkbox
                  capitalize
                  description
                  item={item}
                  itemMap={itemMap}
                  active={selected}
                  selected={selected}
                />
              </InlineSelectItem>
            )
          })}
      </InlineSelectContainer>
    </InputStateHandler>
  )
}
