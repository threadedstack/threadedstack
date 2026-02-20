import type { TSelectItem } from '@TSC/types'
import type { TSelectInput } from './SelectInput'

import { useIsDarkMode } from '@TSC/hooks/theme/useIsDarkMode'
import ListSubheader from '@mui/material/ListSubheader'
import { SelectInput } from './SelectInput'
import { SelectListItem } from './SelectListItem'

export type CategoryItem = {
  header: string
  items: TSelectItem[]
}

export type SelectCategoryProps = {
  items: CategoryItem[]
} & Omit<TSelectInput, 'items'>

export const SelectCategoryInput = (props: SelectCategoryProps) => {
  const { items, value, ...rest } = props

  const isDarkMode = useIsDarkMode()

  const renderCategoryItem = (categoryItem: CategoryItem) => {
    const header = <ListSubheader>{categoryItem.header}</ListSubheader>
    const items = categoryItem.items.map((item) => (
      <SelectListItem
        item={item}
        key={item.value}
        value={item.value}
        isDarkMode={isDarkMode}
        selected={item.value === value}
      />
    ))

    return [header, ...items]
  }

  const renderLabel = () => {
    let label: string | undefined = undefined

    for (const item of items) {
      const foundItem = item.items.find((el) => el.value === value)
      if (foundItem) {
        label = foundItem.label
        break
      }
    }

    return label || ''
  }

  return (
    <SelectInput
      value={value}
      renderLabel={renderLabel}
      {...rest}
    >
      {items.map(renderCategoryItem)}
    </SelectInput>
  )
}
