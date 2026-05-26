import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'
import type { TActionCard } from '@TAF/components/ActionCards/ActionCard'

import { ActionCard } from '@TAF/components/ActionCards/ActionCard'
import { Box, Grid, Divider, Typography } from '@mui/material'

export type TActionCards = {
  sx?: SxProps<Theme>
  title?: ReactNode
  hideHeader?: boolean
  children?: ReactNode
  actions?: TActionCard[]
}

export const ActionCards = (props: TActionCards) => {
  const { sx, actions, children, hideHeader, title = `Actions` } = props

  return (
    <Box sx={sx}>
      {!hideHeader && (
        <Box
          className='tdsk-ac-header-box'
          sx={{
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography
            variant='h6'
            gutterBottom
            className='tdsk-ac-header-title'
          >
            {title}
          </Typography>
          {children}
        </Box>
      )}

      {actions && (
        <>
          {!hideHeader && <Divider sx={{ mb: 2 }} />}
          <Grid
            container
            spacing={2}
            className='tdsk-ac-gird'
          >
            {actions.map((action, idx) => (
              <Grid
                item
                sm={3}
                xs={12}
                key={idx}
              >
                <ActionCard {...action} />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  )
}
