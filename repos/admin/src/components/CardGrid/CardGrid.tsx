import type { ReactNode } from 'react'
import { Grid } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

export type TCardGridItem<T> = {
  key: string
  data: T
}

export type TCardGrid<T> = {
  items: T[]
  getKey: (item: T) => string
  renderCard: (item: T) => ReactNode
  spacing?: number
  xs?: number
  sm?: number
  md?: number
  lg?: number
  sx?: SxProps<Theme>
}

export const CardGrid = <T,>({
  items,
  getKey,
  renderCard,
  spacing = 3,
  xs = 12,
  sm = 6,
  md = 4,
  lg,
  sx,
}: TCardGrid<T>) => {
  return (
    <Grid
      container
      spacing={spacing}
      sx={sx}
    >
      {items.map((item) => (
        <Grid
          item
          xs={xs}
          sm={sm}
          md={md}
          lg={lg}
          key={getKey(item)}
        >
          {renderCard(item)}
        </Grid>
      ))}
    </Grid>
  )
}

export default CardGrid
