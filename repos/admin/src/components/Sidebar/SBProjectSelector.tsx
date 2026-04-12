import { useState } from 'react'
import { cls } from '@keg-hub/jsutils/cls'
import { Box, IconButton } from '@mui/material'
import { Text, ProjectIcon, SelectorMenu } from '@tdsk/components'
import { setProjectActive } from '@TAF/actions/projects/local/setProjectActive'
import { useActiveOrgId, useActiveProjectId, useProjects } from '@TAF/state/selectors'

const styles = {
  container: {
    display: `flex`,
    alignItems: `center`,
    px: 2,
    py: 1.5,
    cursor: `pointer`,
    transition: `background-color 0.2s ease`,
    '&:hover': {
      bgcolor: `action.hover`,
    },
  },
  iconButton: {
    color: `text.primary`,
    ml: `auto`,
    transition: `transform 0.2s ease`,
    [`&.open .MuiSvgIcon-root`]: {
      transform: `rotate(180deg)`,
    },
  },
  text: {
    fontWeight: 500,
    flex: 1,
    overflow: `hidden`,
    whiteSpace: `nowrap`,
    textOverflow: `ellipsis`,
  },
  collapsed: {
    justifyContent: `center`,
    py: 1.5,
  },
}

export type TSBProjectSelector = {
  open?: boolean
  className?: string
  onCreateProject?: () => void
}

export const SBProjectSelector = (props: TSBProjectSelector) => {
  const { open: sidebarOpen, className, onCreateProject } = props

  const [activeOrgId] = useActiveOrgId()
  const [activeProjectId] = useActiveProjectId()
  const [projects] = useProjects()
  const [query, setQuery] = useState('')
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const open = Boolean(anchorEl)

  const onClick = (event: React.MouseEvent<HTMLElement>) => {
    !activeProjectId && setAnchorEl(event.currentTarget)
  }

  const onClose = () => {
    setAnchorEl(null)
    setQuery('')
  }

  if (!activeOrgId || activeProjectId) return null

  const items = projects
    ? Object.values(projects).map((p) => ({
        id: p.id,
        name: p.name || p.id,
        description: p.branch ? `Branch: ${p.branch}` : undefined,
      }))
    : []

  return (
    <>
      <Box
        onClick={onClick}
        sx={sidebarOpen ? styles.container : styles.collapsed}
        className={cls(`tdsk-sb-project-selector`, open && `open`, className)}
      >
        {sidebarOpen ? (
          <>
            <Text
              variant='body2'
              sx={styles.text}
            >
              Select Project
            </Text>
            <IconButton
              size='small'
              sx={styles.iconButton}
              className={open ? `open` : undefined}
              onClick={(e) => {
                e.stopPropagation()
                onClick(e as any)
              }}
            />
          </>
        ) : (
          <ProjectIcon
            text
            sx={{
              fontSize: 20,
              color: `text.secondary`,
            }}
          />
        )}
      </Box>

      <SelectorMenu
        open={open}
        items={items}
        query={query}
        onClose={onClose}
        setQuery={setQuery}
        anchorEl={anchorEl}
        onCreate={onCreateProject}
        activeId={activeProjectId}
        createLabel='Create Project'
        emptyMessage='No projects found'
        searchPlaceholder='Search projects...'
        onSelect={(item) => setProjectActive(item.id)}
      />
    </>
  )
}
