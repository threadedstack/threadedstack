import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'

import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { Box, Paper, Tooltip, IconButton, Typography } from '@mui/material'

const styles = {
  title: { fontWeight: 600 },
  add: { color: `primary.main` },
  remove: { color: `error.main` },
  header: {
    mb: 1,
    display: `flex`,
    alignItems: `center`,
    justifyContent: `space-between`,
  },
  items: {
    container: { display: `flex`, flexDirection: `column`, gap: 1.5 },
    empty: {
      p: 3,
      textAlign: `center`,
      bgcolor: `action.hover`,
    },
    paper: {
      p: 1.5,
      gap: 1,
      display: `flex`,
    },
  },
}

export type TEditorListItem = {
  key: string
  content: ReactNode
}

export type TEditorListProps = {
  label: string
  onAdd: () => void
  footer?: ReactNode
  disabled?: boolean
  className?: string
  addTooltip?: string
  sx?: SxProps<Theme>
  emptyMessage?: string
  removeTooltip?: string
  items: TEditorListItem[]
  onRemove: (index: number) => void
  itemAlign?: `flex-start` | `center`
}

export const EditorList = (props: TEditorListProps) => {
  const {
    sx,
    items,
    label,
    onAdd,
    footer,
    onRemove,
    disabled,
    className,
    itemAlign = `flex-start`,
    addTooltip = `Add ${label.toLowerCase()}`,
    removeTooltip = `Remove ${label.toLowerCase()}`,
    emptyMessage = `No ${label.toLowerCase()} added. Click + to add one.`,
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
          {items.map((item, index) => {
            return (
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
            )
          })}
        </Box>
      )}

      {footer}
    </Box>
  )
}
