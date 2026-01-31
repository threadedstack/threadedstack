import type { Project } from '@tdsk/domain'

import { useState } from 'react'
import { styled } from '@mui/material/styles'
import { ConfirmDelete } from '@tdsk/components'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import { ProjectIcon } from '@TAF/components/Projects/ProjectIcon'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import {
  Box,
  Card,
  Chip,
  Tooltip,
  IconButton,
  Typography,
  CardContent,
  CardActions,
} from '@mui/material'

const CardProj = styled(Card)(({ theme }) => {
  return `
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-top: 5px solid ${theme.palette.border.dark};
  
    &.active {
      2px solid ${theme.palette.primary.main};
    }
  
    &:hover {
      box-shadow: 3;
      transform: translateY(-4px);
    }
  `
})

export type TProjectCard = {
  project: Project
  showDelete?: boolean
  onDelete?: (projectId: string) => void
  onSelect?: (projectId: string) => void
}

export const ProjectCard = (props: TProjectCard) => {
  const { project, onDelete, onSelect, showDelete } = props

  const [deleted, setDeleted] = useState<boolean>(false)
  const [deleting, setDeleting] = useState<boolean>(false)
  const onDeleteCancel = () => setDeleting(false)
  const onDeleteConfirm = () => {
    if (!showDelete) return
    setDeleted(true)
    onDelete?.(project.id)
  }

  return (
    <>
      <CardProj onClick={() => onSelect?.(project.id)}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <ProjectIcon sx={{ mr: 1, color: 'text.secondary' }} />
            <Typography
              variant='h6'
              component='h2'
            >
              {project.name}
            </Typography>
          </Box>

          {project.gitUrl && (
            <Typography
              variant='body2'
              color='text.secondary'
              sx={{ mb: 1, wordBreak: 'break-all' }}
            >
              {project.gitUrl}
            </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            {project.branch && (
              <Chip
                label={project.branch}
                size='small'
                variant='outlined'
              />
            )}
          </Box>

          <Typography
            variant='caption'
            color='text.secondary'
            sx={{ mt: 1, display: 'block' }}
          >
            ID: {project.id}
          </Typography>
        </CardContent>
        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          {showDelete && (
            <Tooltip title='Delete Project'>
              <IconButton
                size='small'
                color='error'
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleting(true)
                }}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title='View Project'>
            <IconButton
              size='small'
              color='primary'
              onClick={(e) => {
                e.stopPropagation()
                onSelect?.(project.id)
              }}
            >
              <PlayCircleOutlineIcon />
            </IconButton>
          </Tooltip>
        </CardActions>
      </CardProj>

      {showDelete && deleting && (
        <ConfirmDelete
          deleting={deleted}
          itemName={project?.name}
          onCancel={onDeleteCancel}
          onConfirm={onDeleteConfirm}
          title={`Delete ${project?.name}`}
          text={
            <Box
              pt={3}
              pb={3}
            >
              Are you sure you want to delete this project?
              <br />
              <br />
              This action cannot be undone and all project data will be lost.
            </Box>
          }
        />
      )}
    </>
  )
}
