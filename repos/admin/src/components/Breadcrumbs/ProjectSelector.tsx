import { useState } from 'react'
import { cls } from '@keg-hub/jsutils/cls'
import { Button, Text } from '@tdsk/components'
import { ProjectIcon } from '@TAF/components/Projects/ProjectIcon'
import { ProjectsMenu } from '@TAF/components/Breadcrumbs/ProjectsMenu'

import {
  useActiveOrgId,
  useActiveProject,
  useActiveProjectId,
} from '@TAF/state/selectors'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'

const styles = {
  icon: {
    fontSize: 18,
  },
  text: {
    fontWeight: 500,
    maxWidth: 150,
    overflow: `hidden`,
    whiteSpace: `nowrap`,
    textOverflow: `ellipsis`,
  },
  button: {
    color: `text.primary`,
    textTransform: `none`,
    [`&.open .MuiButton-endIcon`]: {
      transform: `rotate(180deg)`,
    },
    [`& .MuiButton-endIcon`]: {
      transform: `rotate(0deg)`,
      transition: `transform 0.2s ease`,
    },
  },
}

export type TProjectSelector = {
  className?: string
  onCreateProject?: () => void
}

export const ProjectSelector = (props: TProjectSelector) => {
  const { className, onCreateProject } = props

  const [activeOrgId] = useActiveOrgId()
  const [query, setQuery] = useState('')
  const [activeProject] = useActiveProject()
  const [activeProjectId] = useActiveProjectId()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const open = Boolean(anchorEl)

  const onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const onClose = () => {
    setAnchorEl(null)
    setQuery('')
  }

  return (
    (activeOrgId && (
      <>
        <Button
          onClick={onClick}
          sx={styles.button}
          EndIcon={<ExpandMoreIcon />}
          className={cls(`tdsk-project-selector`, open && `open`, className)}
        >
          <ProjectIcon
            text
            sx={styles.icon}
          />
          <Text
            variant='body2'
            sx={styles.text}
          >
            {activeProject?.name || `Select Project`}
          </Text>
        </Button>

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
    )) ||
    null
  )
}
