import type { Project } from '@tdsk/domain'

import { useMemo } from 'react'
import { useProjects } from '@TAF/state/selectors'
import { getInitials } from '@TAF/utils/text/getInitials'
import { setProjectActive } from '@TAF/actions/projects/local/setProjectActive'
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

const MenuProps = {
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

export type TProjectsMenu = {
  query: string
  open?: boolean
  onClose?: () => void
  activeProjectId?: string
  onCreateProject?: () => void
  anchorEl: null | HTMLElement
  setQuery: (query?: string) => void
  onSelectProject?: (project: Project) => void
}

export const ProjectsMenu = (props: TProjectsMenu) => {
  const {
    open,
    query,
    onClose,
    anchorEl,
    setQuery,
    activeProjectId,
    onCreateProject: onCreateProjectCB,
  } = props

  const [projects] = useProjects()
  const prosArray = useMemo(() => (projects ? Object.values(projects) : []), [projects])

  const { filtered, showSearch, noQueryItems } = useMemo(() => {
    const showSearch = prosArray.length > 3

    if (!query.trim()) return { showSearch, filtered: prosArray, noQueryItems: false }
    const lower = query.toLowerCase()
    const filtered = prosArray.filter((pro) => pro.name?.toLowerCase().includes(lower))

    return {
      filtered,
      showSearch,
      noQueryItems: filtered.length === 0 && query,
    }
  }, [prosArray, query])

  const onSelectProject = (project: Project) => {
    onClose()
    setProjectActive(project.id)
  }

  const onCreateProject = () => {
    onClose()
    onCreateProjectCB?.()
  }

  return (
    <Menu
      {...MenuProps}
      open={open}
      onClose={onClose}
      anchorEl={anchorEl}
    >
      {showSearch && (
        <Box sx={{ px: 1, py: 0.5 }}>
          <TextField
            size='small'
            fullWidth
            placeholder='Search projects...'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
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
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '14px',
              },
            }}
          />
        </Box>
      )}

      {prosArray.length > 3 && <Divider sx={{ my: 0.5 }} />}

      <Box sx={{ maxHeight: 250, overflow: 'auto' }}>
        {prosArray.length === 0 && (
          <MenuItem disabled>
            <Typography
              variant='body2'
              color='text.secondary'
            >
              No projects in this organization
            </Typography>
          </MenuItem>
        )}

        {noQueryItems && (
          <MenuItem disabled>
            <Typography
              variant='body2'
              color='text.secondary'
            >
              No projects found
            </Typography>
          </MenuItem>
        )}

        {filtered.map((project) => (
          <MenuItem
            key={project.id}
            onClick={() => onSelectProject(project)}
            selected={project.id === activeProjectId}
            sx={{
              py: 1,
              '&.Mui-selected': {
                bgcolor: 'action.selected',
              },
            }}
          >
            <ListItemIcon>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: project.id === activeProjectId ? 'primary.main' : 'grey.300',
                  color:
                    project.id === activeProjectId
                      ? 'secondary.contrastText'
                      : 'text.secondary',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {getInitials(project.name)}
              </Box>
            </ListItemIcon>
            <ListItemText
              primary={project.name}
              secondary={project.branch ? `Branch: ${project.branch}` : undefined}
              primaryTypographyProps={{
                sx: {
                  overflow: `hidden`,
                  whiteSpace: `nowrap`,
                  textOverflow: `ellipsis`,
                  fontWeight: project.id === activeProjectId ? 600 : 400,
                },
              }}
              secondaryTypographyProps={{
                sx: {
                  fontSize: `12px`,
                  overflow: `hidden`,
                  whiteSpace: `nowrap`,
                  textOverflow: `ellipsis`,
                },
              }}
            />
            {project.id === activeProjectId && (
              <CheckIcon
                fontSize='small'
                color='secondary'
              />
            )}
          </MenuItem>
        ))}
      </Box>

      {(onCreateProjectCB && <Divider sx={{ my: 0.5 }} />) || null}
      {(onCreateProjectCB && (
        <MenuItem onClick={onCreateProject}>
          <ListItemIcon>
            <AddIcon fontSize='small' />
          </ListItemIcon>
          <ListItemText primary='Create Project' />
        </MenuItem>
      )) ||
        null}
    </Menu>
  )
}
