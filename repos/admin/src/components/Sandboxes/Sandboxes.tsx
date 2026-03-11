import type { Sandbox } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { ConfirmDelete } from '@tdsk/components'
import { useSandboxes } from '@TAF/state/selectors'
import { useEffect, useState, useMemo } from 'react'
import { Box, Typography, Chip } from '@mui/material'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { SandboxDrawer } from '@TAF/components/Sandboxes/SandboxDrawer'
import { fetchSandboxes, deleteSandbox } from '@TAF/actions/sandboxes'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Dns as SandboxIcon,
} from '@mui/icons-material'

export type TSandboxes = {
  orgId: string
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

export const Sandboxes = ({ orgId }: TSandboxes) => {
  const [sandboxes] = useSandboxes()
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<Sandbox>()
  const [error, setError] = useState<Error | null>(null)
  const [selectedSandbox, setSelectedSandbox] = useState<Sandbox | null>(null)

  useEffect(() => {
    const loadSandboxes = async () => {
      if (!orgId) return

      setLoading(true)
      setError(null)

      const result = await fetchSandboxes({ orgId })
      result.error && setError(result.error)

      setLoading(false)
    }

    loadSandboxes()
  }, [orgId])

  const onCreateSandbox = () => {
    setSelectedSandbox(null)
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
    setSelectedSandbox(null)
  }

  const onEditSandbox = (sandbox: Sandbox) => {
    setSelectedSandbox(sandbox)
    setDialogOpen(true)
  }

  const onRemove = async () => {
    if (!deleting) return

    setLoading(true)
    setError(null)

    const result = await deleteSandbox({ orgId, id: deleting.id })
    result.error && setError(result.error)

    setLoading(false)
    setDeleting(undefined)
  }

  const filteredSandboxes = useMemo(() => {
    const sandboxArray = sandboxes ? Object.values(sandboxes) : []
    if (!searchQuery.trim()) return sandboxArray

    const query = searchQuery.toLowerCase()
    return sandboxArray.filter(
      (sandbox) =>
        sandbox.name?.toLowerCase().includes(query) ||
        sandbox.config?.image?.toLowerCase().includes(query)
    )
  }, [sandboxes, searchQuery])

  const sandboxCount = sandboxes ? Object.keys(sandboxes).length : 0

  const columns: TDataTableColumn<Sandbox>[] = [
    {
      id: `name`,
      label: `Name`,
      render: (sandbox: Sandbox) => (
        <Box sx={{ display: `flex`, alignItems: `center`, gap: 1 }}>
          <SandboxIcon sx={{ color: `text.secondary`, fontSize: 20 }} />
          <Typography
            variant='body2'
            fontWeight='medium'
          >
            {sandbox.name}
          </Typography>
        </Box>
      ),
    },
    {
      id: `image`,
      label: `Image`,
      render: (sandbox: Sandbox) => (
        <Typography
          variant='body2'
          fontFamily='monospace'
          color='text.secondary'
        >
          {sandbox.config?.image}
        </Typography>
      ),
    },
    {
      id: `ports`,
      label: `Ports`,
      render: (sandbox: Sandbox) => (
        <Box sx={{ display: `flex`, gap: 0.5, flexWrap: `wrap` }}>
          {Object.keys(sandbox.config?.ports || {}).map((port) => (
            <Chip
              key={port}
              label={port}
              size='small'
              variant='outlined'
            />
          ))}
        </Box>
      ),
    },
    {
      id: `resources`,
      label: `Resources`,
      render: (sandbox: Sandbox) => (
        <Typography
          variant='body2'
          color='text.secondary'
        >
          {sandbox.config?.resources?.limits?.cpu || `-`} /{' '}
          {sandbox.config?.resources?.limits?.memory || `-`}
        </Typography>
      ),
    },
    {
      id: `actions`,
      label: `Actions`,
      align: `right` as const,
      render: (sandbox: Sandbox) => (
        <Box sx={styles.table.actions.box}>
          <ActionIconButton
            tooltip='Edit Sandbox'
            icon={<EditIcon sx={styles.table.actions.icon} />}
            size='small'
            color='primary'
            onClick={(e) => {
              e.stopPropagation()
              onEditSandbox(sandbox)
            }}
          />
          <ActionIconButton
            tooltip='Delete Sandbox'
            size='small'
            color='error'
            icon={<DeleteIcon sx={styles.table.actions.icon} />}
            onClick={(e) => {
              e.stopPropagation()
              setDeleting(sandbox)
            }}
          />
        </Box>
      ),
    },
  ]

  return (
    <PageLayout
      loading={loading}
      countLabel='config'
      query={searchQuery}
      count={sandboxCount}
      error={error?.message}
      title='Sandbox Configs'
      setSearchQuery={setSearchQuery}
      searchCount={filteredSandboxes.length}
      searchPlaceholder='Search sandbox configs...'
      setError={(msg?: string) => setError(msg ? new Error(msg) : null)}
      onAction={sandboxCount > 0 && onCreateSandbox}
      actionLabel={sandboxCount > 0 && 'Create Sandbox'}
    >
      {!error && sandboxCount === 0 && !loading && (
        <EmptyState
          actionIcon={<AddIcon />}
          onAction={onCreateSandbox}
          actionLabel='Create Sandbox'
          message='No sandbox configs yet. Create your first sandbox config to get started.'
        />
      )}

      {!error && sandboxCount > 0 && filteredSandboxes.length === 0 && (
        <EmptyState message='No sandboxes match your search.' />
      )}

      {!error && filteredSandboxes.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredSandboxes}
          onRowClick={onEditSandbox}
          getRowKey={(s) => s.id}
        />
      )}

      {orgId && (
        <SandboxDrawer
          orgId={orgId}
          open={dialogOpen}
          onClose={onDialogClose}
          onRemove={setDeleting}
          sandbox={selectedSandbox}
        />
      )}

      {deleting && (
        <ConfirmDelete
          deleting={loading}
          onConfirm={onRemove}
          itemName={deleting.name}
          onCancel={() => setDeleting(undefined)}
          text={`Are you sure you want to delete "${deleting.name}"? This cannot be undone.`}
        />
      )}
    </PageLayout>
  )
}
