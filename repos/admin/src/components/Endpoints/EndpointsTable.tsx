import type { Endpoint } from '@tdsk/domain'

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
  onEdit: (endpoint: Endpoint) => void
  onDelete: (id: string, name: string) => void
}

export const EndpointsTable = ({ endpoints, onEdit, onDelete }: TEndpointsTable) => {
  return (
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
                      onDelete(endpoint.id, endpoint.name)
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
  )
}
