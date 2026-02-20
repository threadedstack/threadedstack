import type { IInput, TSelectItem } from '@TSC/types'
import type { SxProps, Theme } from '@mui/material'
import type { SelectChangeEvent, SelectProps } from '@mui/material/Select'
import type { MouseEvent, ReactNode } from 'react'

import { grey, primary, gutter } from '@TSC/theme'
import { cls } from '@keg-hub/jsutils/cls'
import { isArr } from '@keg-hub/jsutils/isArr'
import useTheme from '@mui/material/styles/useTheme'
import { ensureArr } from '@keg-hub/jsutils/ensureArr'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import { SelectListItem } from '@TSC/components/Inputs/SelectListItem'
import { SelectInputValue } from '@TSC/components/Inputs/SelectInputValue'
import { InputStateHandler } from '@TSC/components/Inputs/InputStateHandler'
import { SelectItemInput } from '@TSC/components/Inputs/SelectInput.styles'

export type TSelectInput = IInput &
  Omit<SelectProps<string>, `value` | `onChange`> & {
    name?: string
    iconSx?: SxProps
    inline?: boolean
    capitalize?: boolean
    placeholder?: string
    items?: TSelectItem[]
    value?: string | number
    selectSx?: SxProps<Theme>
    children?: React.ReactNode
    renderLabel?: () => string
    itemMap?: Record<string, any>
    selected?: Array<string | number | boolean>
    onChange: (e: SelectChangeEvent) => void
    onItemMouseEnter?: (e: MouseEvent<HTMLLIElement>, itemName: string) => void
    onItemMouseLeave?: (e: MouseEvent<HTMLLIElement>) => void
  }

type TRenderValue = {
  items?: TSelectItem[]
  multiple?: boolean
  placeholder?: string
  capitalize?: boolean
  itemMap?: Record<string, any>
  value: string | number | boolean
  renderLabel: (item?: TSelectItem, value?: string | number | boolean) => ReactNode
}

const RenderValue = (props: TRenderValue) => {
  const { items, value, itemMap, multiple, capitalize, placeholder, renderLabel } = props

  const item = items?.find((item) => item?.value === value)

  return !value || value === '' ? (
    placeholder
  ) : renderLabel ? (
    renderLabel(item, value)
  ) : (
    <SelectInputValue
      item={item}
      itemMap={itemMap}
      spacer={multiple}
      capitalize={capitalize}
    />
  )
}

export const SelectInput = (props: TSelectInput): JSX.Element => {
  const {
    id,
    sx,
    name,
    label,
    items,
    value,
    hidden,
    iconSx,
    ignore,
    inline,
    depends,
    tooltip,
    onClose,
    itemMap,
    variant,
    hasError,
    children,
    selectSx,
    onChange,
    className,
    MenuProps,
    multiple,
    required,
    capitalize,
    inputProps,
    helperText,
    selected = [],
    renderLabel,
    size = `small`,
    disabled = false,
    onItemMouseEnter,
    onItemMouseLeave,
    description = helperText,
    placeholder = `Select`,
    ...rest
  } = props

  const theme = useTheme()
  const isDarkMode = theme.palette.mode === `dark`

  const onChangeCB = (evt: any) => {
    if (!multiple) return onChange?.(evt)

    let updated = [...ensureArr(value)]

    ensureArr(evt?.target?.value).forEach((val) => {
      if (updated.includes(val)) updated = updated.filter((item) => item !== val)
      else updated.push(val)
    })

    onChange({
      ...evt,
      target: {
        ...evt.target,
        value: updated,
      },
    })
  }

  return (
    <InputStateHandler
      id={id}
      sx={sx}
      label={label}
      hidden={hidden}
      tooltip={tooltip}
      disabled={disabled}
      required={required}
      hasError={hasError}
      description={description}
    >
      <SelectItemInput
        {...rest}
        size={size}
        labelId={id}
        displayEmpty
        onClose={onClose}
        multiple={multiple}
        disabled={disabled}
        required={required}
        onChange={onChangeCB}
        variant={variant as any}
        value={multiple ? selected : value}
        className={cls(
          className,
          hasError && `error`,
          hidden && `hidden`,
          disabled && `disabled`,
          required && `required`
        )}
        renderValue={(data) => {
          return multiple && isArr(value) ? (
            value.map((val) => {
              return (
                <RenderValue
                  key={val}
                  value={val}
                  items={items}
                  itemMap={itemMap}
                  multiple={multiple}
                  capitalize={capitalize}
                  placeholder={placeholder}
                  renderLabel={renderLabel}
                />
              )
            })
          ) : (
            <RenderValue
              value={value}
              items={items}
              multiple={false}
              itemMap={itemMap}
              capitalize={capitalize}
              placeholder={placeholder}
              renderLabel={renderLabel}
            />
          )
        }}
        sx={selectSx}
        inputProps={{
          ...inputProps,
          id: id,
          name: name || id,
          className: cls(
            inputProps?.className,
            hidden && `hidden`,
            disabled && `disabled`,
            required && `required`
          ),
          sx: {
            color: `text.primary`,
            fontSize: `14px`,
            fontWeight: 400,
            ...inputProps?.sx,
          },
        }}
        MenuProps={{
          ...MenuProps,
          slotProps: {
            ...MenuProps?.slotProps,
            paper: {
              ...MenuProps?.slotProps?.paper,
              sx: {
                boxShadow: theme.palette.colors.shadow,
                border: `1px solid ${theme.palette.divider}`,
                [`&& .Mui-selected, .Mui-selected.Mui-selected:hover`]: {
                  backgroundColor: isDarkMode ? grey[800] : primary[50],
                },
                // @ts-ignore
                ...MenuProps?.slotProps?.paper?.sx,
              },
            },
          },
          MenuListProps: {
            ...MenuProps?.MenuListProps,
            sx: {
              backgroundColor: isDarkMode ? grey[900] : '',
              ...MenuProps?.MenuListProps?.sx,
            },
          },
        }}
        IconComponent={(props) => (
          <KeyboardArrowDown
            {...props}
            fontSize='16px'
            sx={{
              right: `${gutter.tpx} !important`,
              color: !disabled
                ? `${theme.palette.colors.primaryForeground} !important`
                : '',
              ...iconSx,
            }}
          />
        )}
      >
        {children ||
          items?.map((item) => {
            const isActive = multiple
              ? (value as any)?.includes?.(item.value)
              : item?.value === value

            return (
              <SelectListItem
                item={item}
                active={isActive}
                itemMap={itemMap}
                value={item?.value}
                selected={isActive}
                multiple={multiple}
                isDarkMode={isDarkMode}
                capitalize={capitalize}
                key={item?.value || item?.label}
                data-test={`select-item:${item.label}`}
                onMouseLeave={(e) => onItemMouseLeave?.(e)}
                onMouseEnter={(e) => onItemMouseEnter?.(e, item.label)}
              />
            )
          })}
      </SelectItemInput>
    </InputStateHandler>
  )
}
