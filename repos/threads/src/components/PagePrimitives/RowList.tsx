import type { ReactNode } from 'react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { cmx } from '@TSC/theme/helpers'

export type TRowListColumn = {
  label: string
  width: string
}

export type TRowList = {
  columns: TRowListColumn[]
  children: ReactNode
}

export type TRowListRow = {
  onClick?: () => void
  children: ReactNode
  isLast?: boolean
}

const gridTemplate = (columns: TRowListColumn[]) =>
  columns.map((col) => col.width).join(` `)

const Row = (props: TRowListRow) => {
  const { onClick, children, isLast } = props

  return (
    <Box
      onClick={onClick}
      sx={(theme) => ({
        display: `grid`,
        gridTemplateColumns: `inherit`,
        padding: `14px 18px`,
        ...(!isLast && {
          borderBottom: `1px solid`,
          borderColor: `divider`,
        }),
        ...(onClick && { cursor: `pointer` }),
        '&:hover': {
          bgcolor: cmx(theme.palette.primary.main, `5`),
        },
        '& > *': {
          overflow: `hidden`,
          textOverflow: `ellipsis`,
          whiteSpace: `nowrap`,
        },
      })}
    >
      {children}
    </Box>
  )
}

const RowListRoot = (props: TRowList) => {
  const { columns, children } = props

  const template = gridTemplate(columns)

  return (
    <Box
      sx={{
        bgcolor: `background.paper`,
        border: 1,
        borderColor: `divider`,
        borderRadius: `8px`,
        overflow: `hidden`,
      }}
    >
      <Box
        sx={{
          display: `grid`,
          gridTemplateColumns: template,
          padding: `10px 18px`,
          bgcolor: `background.header`,
          borderBottom: `1px solid`,
          borderColor: `divider`,
        }}
      >
        {columns.map((col) => (
          <Typography
            key={col.label}
            sx={{
              fontSize: `10.5px`,
              fontWeight: 600,
              letterSpacing: `0.08em`,
              textTransform: `uppercase`,
              color: `text.secondary`,
            }}
          >
            {col.label}
          </Typography>
        ))}
      </Box>
      <Box
        sx={{
          display: `grid`,
          gridTemplateColumns: template,
          '& > *': {
            display: `grid`,
            gridTemplateColumns: template,
          },
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export const RowList = Object.assign(RowListRoot, { Row })
