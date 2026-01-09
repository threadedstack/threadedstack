import type { ReactNode } from 'react'
import { Card, CardContent, CardActions, Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

export type TItemCard = {
  children: ReactNode
  actions?: ReactNode
  onClick?: () => void
  actionsPosition?: 'left' | 'right' | 'space-between'
  sx?: SxProps<Theme>
  contentSx?: SxProps<Theme>
}

export const ItemCard = ({
  children,
  actions,
  onClick,
  actionsPosition = 'right',
  sx,
  contentSx,
}: TItemCard) => {
  const getJustifyContent = () => {
    switch (actionsPosition) {
      case 'left':
        return 'flex-start'
      case 'right':
        return 'flex-end'
      case 'space-between':
        return 'space-between'
      default:
        return 'flex-end'
    }
  }

  return (
    <Card
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...sx,
      }}
      onClick={onClick}
    >
      <CardContent sx={{ flex: 1, ...contentSx }}>{children}</CardContent>
      {actions && (
        <CardActions sx={{ justifyContent: getJustifyContent(), px: 2, pb: 2 }}>
          {actions}
        </CardActions>
      )}
    </Card>
  )
}

export default ItemCard
