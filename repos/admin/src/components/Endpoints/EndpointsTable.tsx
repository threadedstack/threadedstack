import type { Endpoint } from '@tdsk/domain'

import { useState } from 'react'
import { ConfirmDelete } from '@tdsk/components'
import {
  Card,
  Chip,
  Table,
  Tooltip,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  IconButton,
  TableContainer,
} from '@mui/material'
import {
  Edit as EditIcon,
  Lock as PrivateIcon,
  Public as PublicIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'

export type TEndpointsTable = {
  endpoints: Endpoint[]
  onDelete: (id: string) => void
  onEdit: (endpoint: Endpoint) => void
}

export const EndpointsTable = (props: TEndpointsTable) => {
  const { onEdit, endpoints, onDelete: onDeleteCB } = props

  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<Endpoint>()
  const onDelete = () => {
    try {
      setLoading(true)
      onDeleteCB?.(deleting.id)
    } finally {
      setLoading(false)
      setDeleting(undefined)
    }
  }

  return (
    <>
      <TableContainer component={Card}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Proxy URL</TableCell>
              <TableCell align='center'>Public</TableCell>
              <TableCell align='right'>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {endpoints.map((endpoint) => (
              <TableRow
                key={endpoint.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => onEdit(endpoint)}
              >
                <TableCell>{endpoint.name}</TableCell>
                <TableCell>
                  <Chip
                    label={endpoint.method}
                    size='small'
                    color='primary'
                    variant='outlined'
                  />
                </TableCell>
                <TableCell
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    wordBreak: 'break-all',
                  }}
                >
                  {endpoint.url}
                </TableCell>
                <TableCell align='center'>
                  {endpoint.public ? (
                    <Tooltip title='Public endpoint'>
                      <PublicIcon color='success' />
                    </Tooltip>
                  ) : (
                    <Tooltip title='Private endpoint'>
                      <PrivateIcon color='action' />
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell align='right'>
                  <Tooltip title='Edit endpoint'>
                    <IconButton
                      size='small'
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(endpoint)
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title='Delete endpoint'>
                    <IconButton
                      size='small'
                      color='error'
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleting(endpoint)
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {(deleting && (
        <ConfirmDelete
          deleting={loading}
          itemName={deleting.name}
          onConfirm={() => onDelete()}
          onCancel={() => setDeleting(undefined)}
          warnText='This action can not be undone!'
        />
      )) ||
        null}
    </>
  )
}
