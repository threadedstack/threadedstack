import type { TSelectorItem } from '@TSC/types'

import { useMemo } from 'react'
import { cls } from '@keg-hub/jsutils/cls'
import { getInitials } from '@TSC/utils/getInitials'
import {
  Add as AddIcon,
  Check as CheckIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import {
  Box,
  Menu,
  Divider,
  MenuItem,
  TextField,
  Typography,
  ListItemIcon,
  ListItemText,
  InputAdornment,
} from '@mui/material'

const menuProps = {
  slotProps: {
    paper: {
      sx: {
        minWidth: 280,
        maxWidth: 320,
        maxHeight: 400,
      },
    },
  },
  anchorOrigin: {
    vertical: `bottom` as const,
    horizontal: `left` as const,
  },
  transformOrigin: {
    vertical: `top` as const,
    horizontal: `left` as const,
  },
}

const styles = {
  divider: { my: 0.5 },
  items: {
    box: { maxHeight: 250, overflow: `auto` },
    item: {
      py: 1,
      [`&.Mui-selected`]: {
        bgcolor: `action.selected`,
      },
    },
    primary: {
      fontWeight: 400,
      overflow: `hidden`,
      whiteSpace: `nowrap`,
      textOverflow: `ellipsis`,
      [`&.active`]: {
        fontWeight: 600,
      },
    },
    secondary: {
      fontSize: `12px`,
      overflow: `hidden`,
      whiteSpace: `nowrap`,
      textOverflow: `ellipsis`,
    },
    initials: {
      width: 32,
      height: 32,
      borderRadius: 1,
      display: `flex`,
      fontSize: `13px`,
      fontWeight: 600,
      bgcolor: `grey.300`,
      color: `text.primary`,
      alignItems: `center`,
      justifyContent: `center`,
      [`&.active`]: {
        bgcolor: `primary.main`,
        color: `primary.contrastText`,
      },
    },
  },
  search: {
    box: { px: 1, py: 0.5 },
    text: {
      [`& .MuiOutlinedInput-root`]: {
        fontSize: `14px`,
      },
    },
  },
}

type TSelectorItemProps = {
  item: TSelectorItem
  active?: boolean
  onSelect: (item: TSelectorItem) => void
}

const SelectorItem = (props: TSelectorItemProps) => {
  const { item, active, onSelect } = props

  return (
    <MenuItem
      key={item.id}
      selected={active}
      sx={styles.items.item}
      onClick={() => onSelect(item)}
    >
      <ListItemIcon>
        <Box
          sx={styles.items.initials}
          className={cls(active && `active`)}
        >
          {getInitials(item.name)}
        </Box>
      </ListItemIcon>
      <ListItemText
        primary={item.name}
        secondary={item.description}
        primaryTypographyProps={{
          sx: styles.items.primary,
          className: active ? `active` : undefined,
        }}
        secondaryTypographyProps={{
          sx: styles.items.secondary,
        }}
      />
      {active && (
        <CheckIcon
          color='primary'
          fontSize='small'
        />
      )}
    </MenuItem>
  )
}

type TSearchProps = {
  query: string
  placeholder?: string
  setQuery: (query: string) => void
}

const Search = (props: TSearchProps) => {
  const { query, placeholder = `Search...`, setQuery } = props
  return (
    <Box sx={styles.search.box}>
      <TextField
        autoFocus
        fullWidth
        size='small'
        value={query}
        sx={styles.search.text}
        placeholder={placeholder}
        onChange={(e) => setQuery(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position='start'>
                <SearchIcon
                  fontSize='small'
                  sx={{ color: 'text.secondary' }}
                />
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  )
}

export type TSelectorMenuProps = {
  query: string
  open?: boolean
  activeId?: string
  onClose: () => void
  createLabel?: string
  emptyMessage?: string
  onCreate?: () => void
  items: TSelectorItem[]
  searchThreshold?: number
  searchPlaceholder?: string
  anchorEl: HTMLElement | null
  setQuery: (query: string) => void
  onSelect: (item: TSelectorItem) => void
}

export const SelectorMenu = (props: TSelectorMenuProps) => {
  const {
    items,
    query,
    setQuery,
    activeId,
    open,
    anchorEl,
    onSelect,
    onClose,
    searchPlaceholder,
    searchThreshold = 3,
    emptyMessage = `No items found`,
    onCreate: onCreateCB,
    createLabel = `Create`,
  } = props

  const { filtered, showSearch } = useMemo(() => {
    const showSearch = items.length > searchThreshold

    if (!query.trim()) return { showSearch, filtered: items }
    const lower = query.toLowerCase()
    const filtered = items.filter((item) => item.name.toLowerCase().includes(lower))

    return { filtered, showSearch }
  }, [items, query, searchThreshold])

  const onSelectItem = (item: TSelectorItem) => {
    onClose()
    onSelect(item)
  }

  const onCreate = () => {
    onClose()
    onCreateCB?.()
  }

  return (
    <Menu
      {...menuProps}
      open={open}
      onClose={onClose}
      anchorEl={anchorEl}
    >
      {showSearch && (
        <Search
          query={query}
          setQuery={setQuery}
          placeholder={searchPlaceholder}
        />
      )}
      {showSearch && <Divider sx={styles.divider} />}

      <Box sx={styles.items.box}>
        {filtered.length === 0 && (
          <MenuItem disabled>
            <Typography
              variant='body2'
              color='text.secondary'
            >
              {emptyMessage}
            </Typography>
          </MenuItem>
        )}

        {filtered.map((item) => (
          <SelectorItem
            item={item}
            key={item.id}
            onSelect={onSelectItem}
            active={item.id === activeId}
          />
        ))}
      </Box>

      {onCreateCB && <Divider sx={styles.divider} />}
      {onCreateCB && (
        <MenuItem onClick={onCreate}>
          <ListItemIcon>
            <AddIcon fontSize='small' />
          </ListItemIcon>
          <ListItemText primary={createLabel} />
        </MenuItem>
      )}
    </Menu>
  )
}
