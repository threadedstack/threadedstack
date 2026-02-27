import { useState, useEffect } from 'react'
import type { ReactNode, ChangeEvent } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
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
  initialRowsPerPage?: number
}

export const DataTable = <T,>({
  sx,
  data,
  columns,
  getRowKey,
  onRowClick,
  hover = true,
  variant = `paper`,
  size = `medium`,
  initialRowsPerPage = 10,
}: TDataTable<T>) => {
  const Container = variant === `card` ? Card : Paper
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage)

  useEffect(() => {
    setPage(0)
  }, [data.length])

  const onChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const onChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(Number.parseInt(event.target.value, 10))
    setPage(0)
  }

  const paginatedData = data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

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
          {paginatedData.map((item) => (
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
      <TablePagination
        page={page}
        component='div'
        count={data.length}
        rowsPerPage={rowsPerPage}
        onPageChange={onChangePage}
        rowsPerPageOptions={[5, 10, 25, 50]}
        onRowsPerPageChange={onChangeRowsPerPage}
      />
    </TableContainer>
  )
}

export default DataTable
