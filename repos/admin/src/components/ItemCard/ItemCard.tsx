import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'

import { Card, CardContent, CardActions } from '@mui/material'

export type TItemCard = {
  children: ReactNode
  actions?: ReactNode
  sx?: SxProps<Theme>
  onClick?: () => void
  contentSx?: SxProps<Theme>
  actionsPosition?: `left` | `right` | `space-between`
}

const justifyMap = {
  left: `flex-start`,
  right: `flex-end`,
  [`space-between`]: `space-between`,
} as const

export const ItemCard = (props: TItemCard) => {
  const { sx, actions, onClick, children, contentSx, actionsPosition = `right` } = props

  const justifyContent = justifyMap[actionsPosition]

  return (
    <Card
      onClick={onClick}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
        ...sx,
      }}
    >
      <CardContent sx={{ flex: 1, ...contentSx }}>{children}</CardContent>
      {actions && (
        <CardActions sx={{ justifyContent, px: 2, pb: 2 }}>{actions}</CardActions>
      )}
    </Card>
  )
}

export default ItemCard
