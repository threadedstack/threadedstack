import { Add as AddIcon } from '@mui/icons-material'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'

export type TNoOrgs = {
  onCreate?: (evt: any) => void
}

/**
 * NoOrgs - Empty state for organizations list
 * Uses the shared EmptyState component
 */
export const NoOrgs = (props: TNoOrgs) => {
  const { onCreate } = props

  return (
    <EmptyState
      message='No organizations yet. Create your first organization to get started.'
      actionLabel='Create'
      actionIcon={<AddIcon />}
      onAction={onCreate}
      actionVariant='contained'
    />
  )
}
