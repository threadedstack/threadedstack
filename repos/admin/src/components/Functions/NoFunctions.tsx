import { Add as AddIcon } from '@mui/icons-material'
import { EmptyState } from '@TAF/components'

export type TNoFunctions = {
  onCreate: () => void
}

export const NoFunctions = ({ onCreate }: TNoFunctions) => {
  return (
    <EmptyState
      message='No functions found for this project.'
      actionLabel='Create Your First Function'
      actionIcon={<AddIcon />}
      onAction={onCreate}
    />
  )
}
