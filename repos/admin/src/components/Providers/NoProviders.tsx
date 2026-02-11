import { EmptyState } from '@TAF/components'
import { Add as AddIcon } from '@mui/icons-material'

export type TNoProviders = {
  onCreate: () => void
}

export const NoProviders = ({ onCreate }: TNoProviders) => {
  return (
    <EmptyState
      message='No providers yet. Create your first provider to get started.'
      actionLabel='Create Provider'
      actionIcon={<AddIcon />}
      onAction={onCreate}
    />
  )
}
