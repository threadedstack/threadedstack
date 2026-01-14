import { EmptyState } from '@TAF/components'
import { PersonAdd as PersonAddIcon } from '@mui/icons-material'

export type TNoUsers = {
  onInvite: () => void
}

export const NoUsers = ({ onInvite }: TNoUsers) => {
  return (
    <EmptyState
      message='No org members yet. Invite users to this org to get started.'
      actionLabel='Invite Your First User'
      actionIcon={<PersonAddIcon />}
      onAction={onInvite}
    />
  )
}
