import type { Organization } from '@tdsk/domain'

import { useMemo } from 'react'
import { cls } from '@keg-hub/jsutils/cls'
import { useOrgs } from '@TAF/state/selectors'
import { getInitials } from '@TAF/utils/text/getInitials'
import { setOrgActive } from '@TAF/actions/orgs/local/setOrgActive'
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

const styles = {
  divider: {
    my: 0.5,
  },
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

const OrgMenuProps = {
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

type TOrgItem = {
  org: Organization
  active?: boolean
  onSelect: (org: Organization) => void
}

type TNoOrgItems = {}
type TCreateOrgItem = {
  onCreateOrg?: () => void
}

type TOrgsSearch = {
  query: string
  setQuery: (query?: string) => void
}

const OrgItem = (props: TOrgItem) => {
  const { org, active, onSelect } = props

  return (
    <MenuItem
      key={org.id}
      selected={active}
      sx={styles.items.item}
      onClick={() => onSelect(org)}
    >
      <ListItemIcon>
        <Box
          sx={styles.items.initials}
          className={cls(active && `active`)}
        >
          {getInitials(org.name)}
        </Box>
      </ListItemIcon>
      <ListItemText
        primary={org.name}
        secondary={org.description}
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

const NoOrgItems = (props: TNoOrgItems) => {
  return (
    <MenuItem disabled>
      <Typography
        variant='body2'
        color='text.secondary'
      >
        No organizations found
      </Typography>
    </MenuItem>
  )
}

const OrgsSearch = (props: TOrgsSearch) => {
  const { query, setQuery } = props
  return (
    <Box sx={styles.search.box}>
      <TextField
        autoFocus
        fullWidth
        size='small'
        value={query}
        sx={styles.search.text}
        placeholder='Search organizations...'
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

const CreateOrgItem = (props: TCreateOrgItem) => {
  const { onCreateOrg } = props
  return (
    <MenuItem onClick={onCreateOrg}>
      <ListItemIcon>
        <AddIcon fontSize='small' />
      </ListItemIcon>
      <ListItemText primary='Create Organization' />
    </MenuItem>
  )
}

export type TOrgsMenu = {
  query: string
  open?: boolean
  activeOrgId?: string
  onClose?: () => void
  onCreateOrg?: () => void
  anchorEl: null | HTMLElement
  setQuery: (query?: string) => void
}

export const OrgsMenu = (props: TOrgsMenu) => {
  const {
    open,
    query,
    onClose,
    anchorEl,
    setQuery,
    activeOrgId,
    onCreateOrg: onCreateOrgCB,
  } = props

  const [orgs] = useOrgs()
  const orgsArray = useMemo(() => (orgs ? Object.values(orgs) : []), [orgs])

  const { filtered, showSearch, noQueryItems } = useMemo(() => {
    const showSearch = orgsArray.length > 3

    if (!query.trim()) return { showSearch, filtered: orgsArray, noQueryItems: false }
    const lower = query.toLowerCase()
    const filtered = orgsArray.filter((org) => org.name?.toLowerCase().includes(lower))

    return {
      filtered,
      showSearch,
      noQueryItems: filtered.length === 0 && query,
    }
  }, [orgsArray, query])

  const onSelectOrg = (org: Organization) => {
    onClose?.()
    setOrgActive(org.id)
  }

  const onCreateOrg = () => {
    onClose?.()
    onCreateOrgCB?.()
  }

  return (
    <Menu
      {...OrgMenuProps}
      open={open}
      onClose={onClose}
      anchorEl={anchorEl}
    >
      {showSearch && (
        <OrgsSearch
          query={query}
          setQuery={setQuery}
        />
      )}
      {showSearch && <Divider sx={styles.divider} />}

      <Box sx={styles.items.box}>
        {noQueryItems && <NoOrgItems />}
        {filtered.map((org) => (
          <OrgItem
            org={org}
            key={org.id}
            onSelect={onSelectOrg}
            active={org.id === activeOrgId}
          />
        ))}
      </Box>

      {(onCreateOrg && <Divider sx={styles.divider} />) || null}
      {(onCreateOrg && <CreateOrgItem onCreateOrg={onCreateOrg} />) || null}
    </Menu>
  )
}
