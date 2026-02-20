import type { SxProps, Theme } from '@mui/material'
import type { MouseEvent, ReactNode } from 'react'

import { cls } from '@keg-hub/jsutils'
import { CardActions as CActions, CardAction } from './Card.styled'

export type TCardAction = {
  name?: string
  text?: ReactNode
  Icon?: ReactNode
  id?: string | number
  sx?: SxProps<Theme>
  children?: ReactNode
  onClick: (event: MouseEvent) => void
}

export type TCardActions = {
  sx?: SxProps<Theme>
  actions: TCardAction[]
  actionSx?: SxProps<Theme>
}

export const CardActions = (props: TCardActions) => {
  const { sx, actions, actionSx } = props

  return (
    <CActions
      sx={sx}
      className='tdsk-card-actions'
    >
      {actions.map((action, idx) => {
        const { sx, id, name, text, onClick, children } = action
        return (
          <CardAction
            onClick={onClick}
            sx={[actionSx, sx] as SxProps<Theme>}
            key={`${id || name || text || idx}`}
            className={cls(
              `tdsk-card-action`,
              id && `tdsk-card-action-${id}`,
              name && `tdsk-card-action-${name}`
            )}
          >
            {children || text}
          </CardAction>
        )
      })}
    </CActions>
  )
}
