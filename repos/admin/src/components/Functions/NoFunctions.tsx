import { Add as AddIcon } from '@mui/icons-material'
import { EmptyState } from '@TAF/components'

export type TNoFunctions = {
  onCreate: () => void
  createDisabled?: boolean
}

export const NoFunctions = ({ onCreate, createDisabled }: TNoFunctions) => {
  return (
    <EmptyState
      onAction={onCreate}
      actionIcon={<AddIcon />}
      actionLabel='Create Function'
      actionDisabled={createDisabled}
      message='No functions found for this project.'
    />
  )
}
