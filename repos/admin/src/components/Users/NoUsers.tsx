import { EmptyState } from '@TAF/components'
import { PersonAdd as PersonAddIcon } from '@mui/icons-material'

export type TNoUsers = {
  onInvite: () => void
}

export const NoUsers = ({ onInvite }: TNoUsers) => {
  return (
    <EmptyState
      onAction={onInvite}
      actionLabel='Invite Users'
      actionIcon={<PersonAddIcon />}
      message='No org members yet. Invite users to this org to get started.'
    />
  )
}
