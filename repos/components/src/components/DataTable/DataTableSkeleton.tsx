import type { SxProps, Theme } from '@mui/material'

import { cls } from '@keg-hub/jsutils/cls'
import { SkeletonWidths } from '@TSC/constants/elements'
import {
  Card,
  Table,
  Paper,
  Skeleton,
  TableRow,
  TableBody,
  TableCell,
  TableHead,
  TableContainer,
} from '@mui/material'

export type TSkeletonColumn = {
  id: string
  label: string
  className?: string
  width?: string | number
  align?: `left` | `center` | `right`
}

export type TDataTableSkeleton = {
  className?: string
  rowCount?: number
  sx?: SxProps<Theme>
  variant?: `paper` | `card`
  size?: `small` | `medium`
  columns: TSkeletonColumn[]
}

export const DataTableSkeleton = (props: TDataTableSkeleton) => {
  const {
    sx,
    columns,
    className,
    rowCount = 5,
    size = `medium`,
    variant = `paper`,
  } = props

  const Container = variant === `card` ? Card : Paper

  return (
    <TableContainer
      sx={sx}
      component={Container}
      className={cls(className, `tdsk-dt-skeleton`)}
    >
      <Table
        className='tdsk-dt-skeleton-table'
        size={size}
      >
        <TableHead className='tdsk-dt-skeleton-table-head'>
          <TableRow className='tdsk-dt-skeleton-table-row'>
            {columns.map((col) => (
              <TableCell
                key={col.id}
                align={col.align}
                width={col.width}
              >
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody className='tdsk-dt-skeleton-table-body'>
          {Array.from({ length: rowCount }, (_, rowIdx) => (
            <TableRow
              className='tdsk-dt-skeleton-table-row'
              key={rowIdx}
            >
              {columns.map((col, colIdx) => (
                <TableCell
                  key={col.id}
                  align={col.align}
                  className='tdsk-dt-skeleton-cell'
                >
                  <Skeleton
                    variant='text'
                    width={SkeletonWidths[(rowIdx + colIdx) % SkeletonWidths.length]}
                    height={24}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
