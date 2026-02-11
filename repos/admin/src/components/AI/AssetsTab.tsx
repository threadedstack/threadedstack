import type { Asset } from '@tdsk/domain'
import { useActiveOrgId, useActiveProjectId, useAssets } from '@TAF/state/selectors'
import { fetchAssets } from '@TAF/actions/assets/api/fetchAssets'
import { deleteAsset } from '@TAF/actions/assets/api/deleteAsset'
import { useState, useEffect, useMemo } from 'react'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import {
  Alert,
  Table,
  TableRow,
  TableCell,
  TableBody,
  TableHead,
  Typography,
  IconButton,
  TableContainer,
} from '@mui/material'
import { Delete as DeleteIcon, Download as DownloadIcon } from '@mui/icons-material'
import { ConfirmDelete } from '@tdsk/components'

export type TAssetsTab = {}

export const AssetsTab = (props: TAssetsTab) => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [assets] = useAssets()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!orgId || !projectId) return

      setLoading(true)
      setError(null)

      const result = await fetchAssets({ orgId, projectId })

      if (result.error) {
        setError(result.error.message)
      }

      setLoading(false)
    }

    loadData()
  }, [orgId, projectId])

  const projectAssets = useMemo(() => {
    if (!assets || !projectId) return []
    let filtered = Object.values(assets).filter((asset) => asset.projectId === projectId)

    if (typeFilter !== 'all') {
      filtered = filtered.filter((asset) => asset.type === typeFilter)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((asset) => {
        return (
          asset.name?.toLowerCase().includes(query) ||
          asset.id?.toLowerCase().includes(query) ||
          asset.type?.toLowerCase().includes(query)
        )
      })
    }

    return filtered.sort(
      (a, b) => ((b as any).createdAt || 0) - ((a as any).createdAt || 0)
    )
  }, [assets, projectId, searchQuery, typeFilter])

  const totalAssetsCount = useMemo(() => {
    if (!assets || !projectId) return 0
    return Object.values(assets).filter((asset) => asset.projectId === projectId).length
  }, [assets, projectId])

  const assetTypes = useMemo(() => {
    if (!assets || !projectId) return []
    const types = new Set(
      Object.values(assets)
        .filter((asset) => asset.projectId === projectId)
        .map((asset) => asset.type)
    )
    return Array.from(types).sort()
  }, [assets, projectId])

  const onDeleteAsset = (asset: Asset) => {
    setSelectedAsset(asset)
    setDeleteDialogOpen(true)
  }

  const onDeleteConfirm = async () => {
    if (!selectedAsset) return

    const result = await deleteAsset(selectedAsset.id)

    if (result.error) {
      setError(result.error.message)
      setDeleteDialogOpen(false)
    } else {
      setSuccess('Asset deleted successfully')
      setDeleteDialogOpen(false)
      setTimeout(() => setSuccess(null), 2000)
      // Refresh assets
      if (orgId && projectId) {
        await fetchAssets({ orgId, projectId })
      }
    }
  }

  const onDownloadAsset = (asset: Asset) => {
    // TODO: Implement asset download
    console.log('Download asset:', asset)
  }

  return (
    <PageLayout
      title='Assets'
      loading={loading}
      error={error}
      setError={setError}
      searchCount={0}
      query={searchQuery}
      countLabel='asset'
      count={totalAssetsCount}
      setSearchQuery={setSearchQuery}
      searchPlaceholder='Search assets by name, type, or ID...'
    >
      {success && (
        <Alert
          severity='success'
          sx={{ mb: 3 }}
        >
          {success}
        </Alert>
      )}

      {totalAssetsCount === 0 && (
        <EmptyState message='No assets found for this project. Assets (images, files, etc.) generated during AI conversations will appear here.' />
      )}

      {totalAssetsCount > 0 && projectAssets.length === 0 && (
        <EmptyState message='No assets match your search or filter criteria.' />
      )}

      {projectAssets.length > 0 && (
        <TableContainer>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Thread ID</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align='right'>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projectAssets.map((asset) => (
                <TableRow
                  key={asset.id}
                  hover
                >
                  <TableCell>
                    <Typography variant='body2'>{asset.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant='body2'
                      fontFamily='monospace'
                      sx={{ fontSize: '0.75rem' }}
                    >
                      {asset.type}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant='body2'
                      fontFamily='monospace'
                      sx={{ fontSize: '0.75rem' }}
                    >
                      {asset.threadId?.substring(0, 8)}...
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant='body2'>
                      {asset.createdAt ? new Date(asset.createdAt).toLocaleString() : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align='right'>
                    <IconButton
                      size='small'
                      color='primary'
                      onClick={() => onDownloadAsset(asset)}
                      title='Download asset'
                    >
                      <DownloadIcon fontSize='small' />
                    </IconButton>
                    <IconButton
                      size='small'
                      color='error'
                      onClick={() => onDeleteAsset(asset)}
                      title='Delete asset'
                    >
                      <DeleteIcon fontSize='small' />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ConfirmDelete
        onConfirm={onDeleteConfirm}
        title='Delete Asset?'
        open={deleteDialogOpen}
        itemName={selectedAsset?.name}
        onCancel={() => {
          setDeleteDialogOpen(false)
          setSelectedAsset(null)
        }}
        warnText='This will permanently delete this asset. This action cannot be undone.'
      />
    </PageLayout>
  )
}
