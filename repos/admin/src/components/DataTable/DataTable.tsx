import type { ReactNode } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Card,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

export type TDataTableColumn<T> = {
  id: string
  label: string
  align?: 'left' | 'center' | 'right'
  width?: string | number
  render: (item: T) => ReactNode
}

export type TDataTable<T> = {
  columns: TDataTableColumn<T>[]
  data: T[]
  getRowKey: (item: T) => string
  onRowClick?: (item: T) => void
  variant?: 'paper' | 'card'
  size?: 'small' | 'medium'
  hover?: boolean
  sx?: SxProps<Theme>
}

export const DataTable = <T,>({
  columns,
  data,
  getRowKey,
  onRowClick,
  variant = 'paper',
  size = 'medium',
  hover = true,
  sx,
}: TDataTable<T>) => {
  const Container = variant === 'card' ? Card : Paper

  return (
    <TableContainer
      component={Container}
      sx={sx}
    >
      <Table size={size}>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.id}
                align={column.align}
                width={column.width}
              >
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((item) => (
            <TableRow
              key={getRowKey(item)}
              hover={hover}
              sx={onRowClick ? { cursor: 'pointer' } : undefined}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                >
                  {column.render(item)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default DataTable
