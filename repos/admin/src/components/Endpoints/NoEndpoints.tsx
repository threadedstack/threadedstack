import { Add as AddIcon } from '@mui/icons-material'
import { EmptyState } from '@TAF/components'

export type TNoEndpoints = {
  onCreate: () => void
}

export const NoEndpoints = ({ onCreate }: TNoEndpoints) => {
  return (
    <EmptyState
      onAction={onCreate}
      actionIcon={<AddIcon />}
      message='No endpoints found for this project.'
      actionLabel='Create Your First Endpoint'
    />
  )
}
