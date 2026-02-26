import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'

import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { Box, Paper, Tooltip, IconButton, Typography } from '@mui/material'

const styles = {
  title: { fontWeight: 600 },
  add: { color: 'primary.main' },
  header: {
    mb: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  items: {
    container: { display: 'flex', flexDirection: 'column', gap: 1.5 },
    empty: {
      p: 3,
      textAlign: 'center',
      bgcolor: 'action.hover',
    },
    paper: {
      p: 1.5,
      gap: 1,
      display: 'flex',
    },
  },
  remove: { color: 'error.main' },
}

export type TEditorListItem = {
  key: string
  content: ReactNode
}

export type TEditorListProps = {
  label: string
  disabled?: boolean
  items: TEditorListItem[]
  onAdd: () => void
  onRemove: (index: number) => void
  addTooltip?: string
  removeTooltip?: string
  emptyMessage?: string
  footer?: ReactNode
  sx?: SxProps<Theme>
  className?: string
  itemAlign?: 'flex-start' | 'center'
}

export const EditorList = (props: TEditorListProps) => {
  const {
    sx,
    items,
    disabled,
    onAdd,
    onRemove,
    className,
    footer,
    label,
    addTooltip = `Add ${label.toLowerCase()}`,
    removeTooltip = `Remove ${label.toLowerCase()}`,
    emptyMessage = `No ${label.toLowerCase()} added. Click + to add one.`,
    itemAlign = 'flex-start',
  } = props

  return (
    <Box
      sx={sx}
      className={className}
    >
      <Box sx={styles.header}>
        <Typography
          variant='subtitle2'
          sx={styles.title}
        >
          {label}
        </Typography>
        <Tooltip title={addTooltip}>
          <IconButton
            size='small'
            sx={styles.add}
            onClick={onAdd}
            disabled={disabled}
          >
            <AddIcon fontSize='small' />
          </IconButton>
        </Tooltip>
      </Box>

      {items.length === 0 ? (
        <Paper
          variant='outlined'
          sx={styles.items.empty}
        >
          <Typography
            variant='body2'
            color='text.secondary'
          >
            {emptyMessage}
          </Typography>
        </Paper>
      ) : (
        <Box sx={styles.items.container}>
          {items.map((item, index) => (
            <Paper
              key={item.key}
              variant='outlined'
              sx={{ ...styles.items.paper, alignItems: itemAlign }}
            >
              {item.content}
              <Tooltip title={removeTooltip}>
                <IconButton
                  size='small'
                  disabled={disabled}
                  sx={styles.remove}
                  onClick={() => onRemove(index)}
                >
                  <DeleteIcon fontSize='small' />
                </IconButton>
              </Tooltip>
            </Paper>
          ))}
        </Box>
      )}

      {footer}
    </Box>
  )
}
