import type { SxProps, Theme } from '@mui/material'
import type { ReactNode } from 'react'
import type { TCardAction } from './CardActions'

import { cls } from '@keg-hub/jsutils'
import { CardActions } from './CardActions'

import { CardMain, CardContent, CardContainer } from './Card.styled'

export type TCard = {
  sx?: SxProps<Theme>
  children?: ReactNode
  cardSx?: SxProps<Theme>
  actions?: TCardAction[]
  actionSx?: SxProps<Theme>
  contentSx?: SxProps<Theme>
  actionsSx?: SxProps<Theme>
  className?: string | string[]
  cardClass?: string | string[]
  onClick?: (evt: any) => void
  variant?: `elevation` | `outlined`
}

export const Card = (props: TCard) => {
  const {
    sx,
    cardSx,
    actions,
    variant,
    onClick,
    children,
    cardClass,
    contentSx,
    actionSx,
    actionsSx,
    className,
  } = props

  return (
    <CardContainer
      sx={sx}
      onClick={onClick}
      className={cls(`tdsk-card-container`, className)}
    >
      <CardMain
        sx={cardSx}
        variant={variant}
        className={cls(`tdsk-card-main`, cardClass)}
      >
        <CardContent
          sx={contentSx}
          className='tdsk-card-content'
        >
          {children}
        </CardContent>
        {actions?.length ? (
          <CardActions
            sx={actionsSx}
            actions={actions}
            actionSx={actionSx}
          />
        ) : null}
      </CardMain>
    </CardContainer>
  )
}
