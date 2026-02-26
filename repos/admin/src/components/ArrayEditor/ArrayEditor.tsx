import type { SxProps, Theme } from '@mui/material'

import { Box } from '@mui/material'
import { TextInput } from '@tdsk/components'
import { cls } from '@keg-hub/jsutils/cls'
import { EditorList } from '@TAF/components/EditorList/EditorList'

export type TArrayEditorProps = {
  label?: string
  items: string[]
  className?: string
  disabled?: boolean
  placeholder?: string
  sx?: SxProps<Theme>
  onChange: (items: string[]) => void
  itemPlaceholder?: (index: number) => string
}

/**
 * ArrayEditor - Editable array of text values with add/remove functionality
 *
 * Features:
 * - Add/remove items dynamically
 * - Simple text input for each item
 * - Empty state display
 * - Customizable placeholders
 */
export const ArrayEditor = (props: TArrayEditorProps) => {
  const {
    sx,
    items,
    disabled,
    onChange,
    className,
    label = `Items`,
    itemPlaceholder,
    placeholder = `Item`,
  } = props

  const addItem = () => onChange([...items, ``])

  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index))

  const updateItem = (index: number, value: string) => {
    const newItems = [...items]
    newItems[index] = value
    onChange(newItems)
  }

  const getPlaceholder = (index: number): string => {
    return itemPlaceholder ? itemPlaceholder(index) : `${placeholder} ${index + 1}`
  }

  return (
    <EditorList
      sx={sx}
      label={label}
      disabled={disabled}
      className={cls(className, `tdsk-array-editor`)}
      onAdd={addItem}
      onRemove={removeItem}
      addTooltip={`Add ${placeholder.toLowerCase()}`}
      removeTooltip={`Remove ${placeholder.toLowerCase()}`}
      emptyMessage={`No ${label.toLowerCase()} added. Click + to add one.`}
      itemAlign='center'
      items={items.map((item, index) => ({
        key: String(index),
        content: (
          <Box sx={{ flex: 1 }}>
            <TextInput
              fullWidth
              size='small'
              value={item}
              id={undefined}
              disabled={disabled}
              placeholder={getPlaceholder(index)}
              onChange={(e) => updateItem(index, e.target.value)}
            />
          </Box>
        ),
      }))}
    />
  )
}
