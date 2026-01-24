import type { SxProps, Theme } from '@mui/material'

import { TextInput } from '@tdsk/components'
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { Box, Paper, Tooltip, IconButton, Typography } from '@mui/material'
import { cls } from '@keg-hub/jsutils/cls'

const styles = {
  title: { fontWeight: 600 },
  add: { color: `primary.main` },
  container: {
    mb: 1,
    display: `flex`,
    alignItems: `center`,
    justifyContent: `space-between`,
  },
  items: {
    box: { flex: 1 },
    remove: { color: `error.main` },
    container: { display: `flex`, flexDirection: `column`, gap: 1.5 },
    nopaper: {
      p: 3,
      textAlign: `center`,
      bgcolor: `action.hover`,
    },
    paper: {
      p: 1.5,
      gap: 1,
      display: `flex`,
      alignItems: `center`,
    },
  },
}

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
    <Box
      sx={sx}
      className={cls(className, `tdsk-array-editor`)}
    >
      <Box
        className='tdsk-array-editor-box'
        sx={styles.container}
      >
        <Typography
          sx={styles.title}
          variant='subtitle2'
          className='tdsk-array-editor-title'
        >
          {label}
        </Typography>
        <Tooltip title={`Add ${placeholder.toLowerCase()}`}>
          <IconButton
            size='small'
            sx={styles.add}
            onClick={addItem}
            disabled={disabled}
          >
            <AddIcon fontSize='small' />
          </IconButton>
        </Tooltip>
      </Box>

      {items.length === 0 ? (
        <Paper
          variant='outlined'
          className='tdsk-array-editor-paper'
          sx={styles.items.nopaper}
        >
          <Typography
            variant='body2'
            color='text.secondary'
            className='tdsk-array-editor-paper-text'
          >
            No {label.toLowerCase()} added. Click + to add one.
          </Typography>
        </Paper>
      ) : (
        <Box sx={styles.items.container}>
          {items.map((item, index) => (
            <Paper
              key={index}
              variant='outlined'
              sx={styles.items.paper}
              className='tdsk-array-editor-paper'
            >
              <Box
                className='tdsk-array-editor-item-box'
                sx={styles.items.box}
              >
                <TextInput
                  fullWidth
                  size='small'
                  value={item}
                  id={undefined}
                  disabled={disabled}
                  placeholder={getPlaceholder(index)}
                  className='tdsk-array-editor-item-input'
                  onChange={(e) => updateItem(index, e.target.value)}
                />
              </Box>
              <Tooltip title={`Remove ${placeholder.toLowerCase()}`}>
                <IconButton
                  size='small'
                  disabled={disabled}
                  sx={styles.items.remove}
                  onClick={() => removeItem(index)}
                  className='tdsk-array-editor-rm-button'
                >
                  <DeleteIcon fontSize='small' />
                </IconButton>
              </Tooltip>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  )
}
