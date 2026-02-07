import { Add as AddIcon } from '@mui/icons-material'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'

export type TNoProjects = {
  onCreate?: () => void
}

/**
 * NoProjects - Empty state for projects list
 * Uses the shared EmptyState component
 */
export const NoProjects = (props: TNoProjects) => {
  const { onCreate } = props

  return (
    <EmptyState
      message='No projects yet. Create your first project to get started.'
      actionLabel='Create Project'
      onAction={onCreate}
      actionIcon={<AddIcon />}
    />
  )
}
