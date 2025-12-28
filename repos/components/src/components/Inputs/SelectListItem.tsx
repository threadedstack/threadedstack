import type { TSelectItem } from '@TSC/types'
import type { MenuItemProps } from '@mui/material/MenuItem'

import { SelectMenuItem } from '@TSC/components/Inputs/SelectInput.styles'
import { SelectInputValue } from '@TSC/components/Inputs/SelectInputValue'
import { NotificationCount } from '@TSC/components/NotificationCount'
import { grey, primary } from '@TSC/theme/index'
import { cls } from '@keg-hub/jsutils/cls'

export type TSelectListItem = MenuItemProps & {
  item: TSelectItem
  active?: boolean
  selected: boolean
  checkbox?: boolean
  multiple?: boolean
  icon?: JSX.Element
  isDarkMode: boolean
  capitalize?: boolean
  itemMap?: Record<string, any>
}

export const SelectListItem = (props: TSelectListItem) => {
  const {
    item,
    icon,
    active,
    itemMap,
    selected,
    multiple,
    checkbox,
    className,
    isDarkMode,
    capitalize,
    ...rest
  } = props

  return (
    <SelectMenuItem
      {...rest}
      value={item.value}
      className={cls(multiple && `multiple`, className)}
      sx={{
        display: 'flex',
        fontWeight: 500,
        fontSize: '14px',
        justifyContent: 'space-between',
        color: isDarkMode
          ? selected
            ? grey[100]
            : grey[500]
          : selected
            ? primary[500]
            : grey[700],
        backgroundColor: isDarkMode
          ? selected
            ? grey[800]
            : `transparent`
          : selected
            ? primary[50]
            : `transparent`,
        '&:hover': {
          color: isDarkMode
            ? selected
              ? grey[100]
              : grey[300]
            : selected
              ? primary[500]
              : primary[600],

          backgroundColor: isDarkMode
            ? selected
              ? grey[800]
              : grey[850]
            : selected
              ? primary[50]
              : primary[50],

          '& .notification-count': {
            color: isDarkMode ? grey[400] : primary[500],
            backgroundColor: isDarkMode ? grey[850] : primary[100],
          },
        },
      }}
    >
      <SelectInputValue
        description
        item={item}
        active={active}
        itemMap={itemMap}
        selected={selected}
        multiple={multiple}
        checkbox={checkbox}
        capitalize={capitalize}
      />

      {item.notificationCount ? (
        <NotificationCount count={item.notificationCount} />
      ) : null}
    </SelectMenuItem>
  )
}
