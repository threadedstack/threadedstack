import type { Project } from '@tdsk/domain'

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { cls } from '@keg-hub/jsutils/cls'
import { setActiveProjectId } from '@TAF/state/accessors'
import {
  useProjects,
  useActiveOrgId,
  useActiveProject,
  useActiveProjectId,
} from '@TAF/state/selectors'
import {
  Add as AddIcon,
  Check as CheckIcon,
  Search as SearchIcon,
  Folder as ProjectIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material'
import {
  Box,
  Menu,
  Button,
  Divider,
  MenuItem,
  TextField,
  Typography,
  ListItemIcon,
  ListItemText,
  InputAdornment,
} from '@mui/material'

export type TProjectSelector = {
  className?: string
  onCreateProject?: () => void
}

export const ProjectSelector = (props: TProjectSelector) => {
  const { className, onCreateProject: onCreateProjectCB } = props

  const navigate = useNavigate()
  const [projects] = useProjects()
  const [activeOrgId] = useActiveOrgId()
  const [activeProject] = useActiveProject()
  const [activeProjectId] = useActiveProjectId()
  const [searchQuery, setSearchQuery] = useState('')
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const open = Boolean(anchorEl)

  const onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const onClose = () => {
    setAnchorEl(null)
    setSearchQuery('')
  }

  const onSelectProject = (project: Project) => {
    setActiveProjectId(project.id)
    navigate(`/orgs/${activeOrgId}/projects/${project.id}`)
    onClose()
  }

  const onCreateProject = () => {
    onClose()
    onCreateProjectCB?.()
  }

  // Filter projects to only show those belonging to the active org
  const orgProjects = useMemo(() => {
    if (!projects || !activeOrgId) return []
    return Object.values(projects).filter((project) => project.orgId === activeOrgId)
  }, [projects, activeOrgId])

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return orgProjects
    const query = searchQuery.toLowerCase()
    return orgProjects.filter(
      (project) =>
        project.name?.toLowerCase().includes(query) ||
        project.branch?.toLowerCase().includes(query)
    )
  }, [orgProjects, searchQuery])

  const getProjectInitials = (name: string) => {
    if (!name) return '?'
    const words = name.split(' ')
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  if (!activeOrgId) return null

  return (
    <>
      <Button
        onClick={onClick}
        className={cls('tdsk-project-selector', className)}
        endIcon={<ExpandMoreIcon />}
        sx={{
          textTransform: 'none',
          color: 'text.primary',
          '& .MuiButton-endIcon': {
            transition: 'transform 0.2s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          },
        }}
      >
        <Box
          sx={{
            mr: 1,
            width: 28,
            height: 28,
            borderRadius: 1,
            display: 'flex',
            fontWeight: 600,
            fontSize: '12px',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: activeProject ? 'secondary.main' : 'grey.400',
            color: activeProject ? 'secondary.contrastText' : 'text.primary',
          }}
        >
          {activeProject ? (
            getProjectInitials(activeProject.name)
          ) : (
            <ProjectIcon sx={{ fontSize: 16 }} />
          )}
        </Box>
        <Typography
          variant='body2'
          sx={{
            maxWidth: 150,
            fontWeight: 500,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {activeProject?.name || 'Select Project'}
        </Typography>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            sx: {
              minWidth: 280,
              maxWidth: 320,
              maxHeight: 400,
            },
          },
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        {orgProjects.length > 3 && (
          <Box sx={{ px: 1, py: 0.5 }}>
            <TextField
              size='small'
              fullWidth
              placeholder='Search projects...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

        {orgProjects.length > 3 && <Divider sx={{ my: 0.5 }} />}

        <Box sx={{ maxHeight: 250, overflow: 'auto' }}>
          {orgProjects.length === 0 && (
            <MenuItem disabled>
              <Typography
                variant='body2'
                color='text.secondary'
              >
                No projects in this organization
              </Typography>
            </MenuItem>
          )}

          {filteredProjects.length === 0 && searchQuery && orgProjects.length > 0 && (
            <MenuItem disabled>
              <Typography
                variant='body2'
                color='text.secondary'
              >
                No projects found
              </Typography>
            </MenuItem>
          )}

          {filteredProjects.map((project) => (
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
                    bgcolor:
                      project.id === activeProjectId ? 'secondary.main' : 'grey.300',
                    color:
                      project.id === activeProjectId
                        ? 'secondary.contrastText'
                        : 'text.primary',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {getProjectInitials(project.name)}
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
    </>
  )
}
