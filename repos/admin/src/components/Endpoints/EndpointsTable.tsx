import type { Endpoint } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components/DataTable/DataTable'

import { useState } from 'react'
import { ConfirmDelete } from '@tdsk/components'
import { Box, Chip, Tooltip } from '@mui/material'
import { EndpointTypeOpts } from '@TAF/constants/values'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import {
  Edit as EditIcon,
  Lock as PrivateIcon,
  Public as PublicIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'

export type TEndpointsTable = {
  endpoints: Endpoint[]
  onDelete: (id: string) => void
  onNavigate: (endpoint: Endpoint) => void
}

const styles = {
  table: {
    actions: {
      box: {
        gap: 1.5,
        display: `flex`,
        alignItems: `center`,
        justifyContent: `end`,
      },
      icon: { fontSize: `16px` },
    },
  },
}

export const EndpointsTable = (props: TEndpointsTable) => {
  const { onNavigate, endpoints, onDelete: onDeleteCB } = props

  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<Endpoint>()
  const onDelete = () => {
    if (!deleting) return

    try {
      setLoading(true)
      onDeleteCB?.(deleting.id)
    } finally {
      setLoading(false)
      setDeleting(undefined)
    }
  }

  const columns: TDataTableColumn<Endpoint>[] = [
    {
      id: `name`,
      label: `Name`,
      render: (endpoint) => endpoint.name,
    },
    {
      id: `method`,
      label: `Method`,
      render: (endpoint) => (
        <Chip
          label={endpoint.method}
          size='small'
          color='primary'
          variant='outlined'
        />
      ),
    },
    {
      id: `type`,
      label: `Type`,
      render: (endpoint) => (
        <Chip
          size='small'
          color='secondary'
          variant='outlined'
          label={
            EndpointTypeOpts.find((o) => o.value === endpoint.type)?.label ||
            endpoint.type
          }
        />
      ),
    },
    {
      id: `path`,
      label: `Path`,
      render: (endpoint) => (
        <Box
          component='span'
          sx={{
            fontFamily: `monospace`,
            fontSize: `0.875rem`,
            wordBreak: `break-all`,
          }}
        >
          {endpoint.path}
        </Box>
      ),
    },
    {
      id: `public`,
      label: `Public`,
      align: `center`,
      render: (endpoint) =>
        endpoint.public ? (
          <Tooltip title='Public endpoint'>
            <PublicIcon color='success' />
          </Tooltip>
        ) : (
          <Tooltip title='Private endpoint'>
            <PrivateIcon color='action' />
          </Tooltip>
        ),
    },
    {
      id: `actions`,
      label: `Actions`,
      align: `right`,
      render: (endpoint) => (
        <Box sx={styles.table.actions.box}>
          <ActionIconButton
            tooltip='Edit endpoint'
            icon={<EditIcon sx={styles.table.actions.icon} />}
            size='small'
            color='primary'
            onClick={(e) => {
              e.stopPropagation()
              onNavigate(endpoint)
            }}
          />
          <ActionIconButton
            tooltip='Delete endpoint'
            icon={<DeleteIcon sx={styles.table.actions.icon} />}
            size='small'
            color='error'
            onClick={(e) => {
              e.stopPropagation()
              setDeleting(endpoint)
            }}
          />
        </Box>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={endpoints}
        onRowClick={onNavigate}
        getRowKey={(endpoint) => endpoint.id}
      />
      {deleting && (
        <ConfirmDelete
          deleting={loading}
          onConfirm={onDelete}
          itemName={deleting.name}
          onCancel={() => setDeleting(undefined)}
          warnText='This action can not be undone!'
        />
      )}
    </>
  )
}
