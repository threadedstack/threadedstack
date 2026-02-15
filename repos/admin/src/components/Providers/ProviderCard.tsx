import type { Provider } from '@tdsk/domain'

import { Box, Typography, Chip } from '@mui/material'
import { Edit as EditIcon, CloudQueue as ProviderIcon } from '@mui/icons-material'
import { ItemCard, ActionIconButton } from '@TAF/components'

export type TProviderCard = {
  provider: Provider
  onEdit?: (providerId: string) => void
}

export const ProviderCard = ({ provider, onEdit }: TProviderCard) => {
  const handleEdit = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    onEdit?.(provider.id)
  }

  return (
    <ItemCard
      onClick={onEdit ? () => handleEdit() : undefined}
      actionsPosition='left'
      actions={
        onEdit ? (
          <ActionIconButton
            tooltip='Edit Provider'
            icon={<EditIcon />}
            size='small'
            color='primary'
            onClick={handleEdit}
          />
        ) : undefined
      }
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <ProviderIcon sx={{ mr: 1, color: 'text.secondary' }} />
        <Typography
          variant='h6'
          component='h2'
        >
          {provider.options?.name || 'Unnamed Provider'}
        </Typography>
      </Box>

      {provider.type && (
        <Chip
          label={provider.type}
          size='small'
          color='primary'
          variant='outlined'
          sx={{ mb: 1 }}
        />
      )}

      {provider.options?.baseUrl && (
        <Typography
          variant='body2'
          color='text.secondary'
          sx={{ mb: 1, wordBreak: 'break-all' }}
        >
          {provider.options.baseUrl}
        </Typography>
      )}

      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ mt: 1, display: 'block' }}
      >
        ID: {provider.id}
      </Typography>
    </ItemCard>
  )
}
