import type { Asset } from '@tdsk/domain'
import { useActiveOrgId, useActiveProjectId, useAssets } from '@TAF/state/selectors'
import { fetchAssets } from '@TAF/actions/assets/api/fetchAssets'
import { deleteAsset } from '@TAF/actions/assets/api/deleteAsset'
import { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Card,
  Table,
  Alert,
  TableRow,
  TextField,
  TableCell,
  TableBody,
  TableHead,
  Typography,
  IconButton,
  CardContent,
  InputAdornment,
  TableContainer,
} from '@mui/material'
import {
  Delete as DeleteIcon,
  Clear as ClearIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
} from '@mui/icons-material'
import { Loading, ConfirmDelete } from '@tdsk/components'

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
    <Box>
      {loading && (
        <Loading
          fixed
          full
        />
      )}

      {error && (
        <Alert
          severity='error'
          sx={{ mb: 3 }}
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          severity='success'
          sx={{ mb: 3 }}
        >
          {success}
        </Alert>
      )}

      {!loading && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant='h6'>Assets</Typography>
                <Typography
                  variant='body2'
                  color='text.secondary'
                >
                  {totalAssetsCount} asset{totalAssetsCount !== 1 ? 's' : ''}
                </Typography>
              </Box>
            </Box>

            {totalAssetsCount > 0 && (
              <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  placeholder='Search assets by name, type, or ID...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size='small'
                  sx={{ flex: 1, minWidth: 200 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position='start'>
                        <SearchIcon color='action' />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery && (
                      <InputAdornment position='end'>
                        <IconButton
                          size='small'
                          onClick={() => setSearchQuery('')}
                          edge='end'
                        >
                          <ClearIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            )}

            {totalAssetsCount === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color='text.secondary'>
                  No assets found for this project. Assets (images, files, etc.) generated
                  during AI conversations will appear here.
                </Typography>
              </Box>
            )}

            {totalAssetsCount > 0 && projectAssets.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color='text.secondary'>
                  No assets match your search or filter criteria.
                </Typography>
              </Box>
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
                            {asset.createdAt
                              ? new Date(asset.createdAt).toLocaleString()
                              : '-'}
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
          </CardContent>
        </Card>
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
    </Box>
  )
}
