import type { ReactNode } from 'react'

import Box from '@mui/material/Box'
import { cmx } from '@TSC/theme/helpers'
import { cls } from '@keg-hub/jsutils/cls'
import Typography from '@mui/material/Typography'

export type TRowListColumn = {
  label: string
  width: string
  className?: string
}

export type TRowList = {
  children: ReactNode
  className?: string
  columns: TRowListColumn[]
}

export type TRowListRow = {
  isLast?: boolean
  className?: string
  children: ReactNode
  onClick?: () => void
}

const gridTemplate = (columns: TRowListColumn[]) =>
  columns.map((col) => col.width).join(` `)

const Row = (props: TRowListRow) => {
  const { className, onClick, children, isLast } = props

  return (
    <Box
      className={cls(className, `tdsk-row-list-row`)}
      onClick={onClick}
      sx={(theme) => ({
        display: `grid`,
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
          whiteSpace: `nowrap`,
          textOverflow: `ellipsis`,
        },
      })}
    >
      {children}
    </Box>
  )
}

const RowListRoot = (props: TRowList) => {
  const { className, columns, children } = props

  const template = gridTemplate(columns)

  return (
    <Box
      className={cls(className, `tdsk-row-list-root`)}
      sx={{
        border: 1,
        borderRadius: `8px`,
        overflow: `hidden`,
        borderColor: `divider`,
        bgcolor: `background.paper`,
      }}
    >
      <Box
        className='tdsk-row-list-grid-labels'
        sx={{
          display: `grid`,
          padding: `10px 18px`,
          borderColor: `divider`,
          borderBottom: `1px solid`,
          bgcolor: `background.header`,
          gridTemplateColumns: template,
        }}
      >
        {columns.map((col) => (
          <Typography
            className='tdsk-row-list-column-label'
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
        className='tdsk-row-list-grid-container'
        sx={{
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
