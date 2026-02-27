import type { ReactNode, ComponentType } from 'react'
import { Card, Typography, CardContent } from '@mui/material'

export type TActionCard = {
  route?: string
  title?: ReactNode
  subtitle?: ReactNode
  Icon?: ComponentType<any>
  iconProps?: Record<string, any>
  titleProps?: Record<string, any>
  subtitleProps?: Record<string, any>
  onClick?: (evt: any, props: TActionCard) => any
}

export const ActionCard = (props: TActionCard) => {
  const { Icon, title, onClick, subtitle, iconProps, titleProps, subtitleProps } = props

  return (
    <Card
      variant='outlined'
      className='tdsk-ac-card'
      sx={{
        cursor: 'pointer',
        '&:hover': { borderColor: 'primary.main' },
      }}
      onClick={(evt) => onClick?.(evt, props)}
    >
      <CardContent
        className='tdsk-ac-card-content'
        sx={{ textAlign: 'center' }}
      >
        {(Icon && (
          <Icon
            color='primary'
            className='tdsk-ac-card-icon'
            {...iconProps}
            sx={{ fontSize: 40, ...iconProps?.sx }}
          />
        )) ||
          null}

        {(title && (
          <Typography
            variant='subtitle1'
            className='tdsk-ac-card-title'
            {...titleProps}
            sx={{ mt: 1, ...titleProps?.sx }}
          >
            {title}
          </Typography>
        )) ||
          null}
        {(subtitle && (
          <Typography
            variant='body2'
            color='text.secondary'
            className='tdsk-ac-card-subtitle'
            {...subtitleProps}
          >
            {subtitle}
          </Typography>
        )) ||
          null}
      </CardContent>
    </Card>
  )
}
