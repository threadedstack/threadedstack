// @ts-nocheck
import { useState } from 'react'
import { Text } from '@tdsk/components'
import { cls } from '@keg-hub/jsutils/cls'
import { Box, IconButton } from '@mui/material'
import { ProjectIcon } from '@TTH/components/Projects/ProjectIcon'
import { ProjectsMenu } from '@TTH/components/Projects/ProjectsMenu'
import { useActiveOrgId, useActiveProjectId } from '@TTH/state/selectors'

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

  // Only show if there's an active org but no active project
  if (!activeOrgId || activeProjectId) return null

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

      <ProjectsMenu
        open={open}
        query={query}
        onClose={onClose}
        anchorEl={anchorEl}
        setQuery={setQuery}
        activeProjectId={activeProjectId}
        onCreateProject={onCreateProject}
      />
    </>
  )
}
