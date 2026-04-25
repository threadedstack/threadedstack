import { Add as AddIcon } from '@mui/icons-material'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'

export type TNoProjects = {
  onCreate?: () => void
  createDisabled?: boolean
}

/**
 * NoProjects - Empty state for projects list
 * Uses the shared EmptyState component
 */
export const NoProjects = (props: TNoProjects) => {
  const { onCreate, createDisabled } = props

  return (
    <EmptyState
      onAction={onCreate}
      actionIcon={<AddIcon />}
      actionLabel='Create Project'
      actionDisabled={createDisabled}
      message='No projects yet. Create your first project to get started.'
    />
  )
}
