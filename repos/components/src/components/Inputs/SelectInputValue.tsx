import type { TSelectItem } from '@TSC/types'
import type { SxProps, Theme } from '@mui/material'

import { cls } from '@keg-hub/jsutils/cls'
import { wordCaps } from '@keg-hub/jsutils/wordCaps'
import Checkbox from '@mui/material/Checkbox/Checkbox'
import { OptionDesc, OptionLabel } from '@TSC/components/Inputs/Inputs.styles'
import {
  SelectItemStack,
  SelectItemText,
} from '@TSC/components/Inputs/SelectInput.styles'

export type TSelectInputValue = {
  className?: string
  sx?: SxProps<Theme>
  item: TSelectItem
  bold?: boolean
  spacer?: boolean
  active?: boolean
  multiple?: boolean
  selected?: boolean
  checkbox?: boolean
  capitalize?: boolean
  inlineText?: boolean
  description?: boolean
  itemMap?: Record<string, any>
}

export const SelectInputValue = (props: TSelectInputValue) => {
  const {
    sx,
    item,
    bold,
    spacer,
    active,
    itemMap,
    multiple,
    checkbox,
    className,
    inlineText,
    capitalize,
    description,
  } = props

  const selected = props?.selected || active

  const data = itemMap?.[item?.value] || item
  let display = `${data?.label || item?.label || item?.value}`
  display = capitalize ? wordCaps(display) : display

  return (
    <SelectItemStack
      sx={sx}
      spacing={2}
      direction='row'
      alignItems='center'
      className={cls(className, spacer && `spacer`, multiple && `multiple`)}
    >
      {item?.icon ? (
        item?.icon
      ) : multiple || checkbox ? (
        <Checkbox
          sx={{ height: `20px`, width: `20px` }}
          checked={selected}
        />
      ) : null}

      <SelectItemText
        className={cls(
          `tdsk-select-item-text`,
          multiple && `multiple`,
          item?.prefix ? `prefix` : false,
          item?.postfix ? `postfix` : false,
          inlineText ? `inline-text` : false
        )}
      >
        <OptionLabel
          className={cls(((description && data?.description) || bold) && `bold`)}
        >
          {(item?.prefix && <span className='prefix'>{item?.prefix}</span>) || null}
          <span className='text'>{display}</span>
          {(item?.postfix && <span className='postfix'>{item?.postfix}</span>) || null}
        </OptionLabel>

        {(description && data?.description && (
          <OptionDesc>{data?.description}</OptionDesc>
        )) ||
          null}
      </SelectItemText>
    </SelectItemStack>
  )
}
