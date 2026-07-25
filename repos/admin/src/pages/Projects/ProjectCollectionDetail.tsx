import type { ChangeEvent } from 'react'
import type { Record as RecordModel } from '@tdsk/domain'

import { useMemo, useState, useEffect } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { TextInput, ConfirmDelete } from '@tdsk/components'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { deleteRecord } from '@TAF/actions/records/api/deleteRecord'
import { upsertRecord } from '@TAF/actions/records/api/upsertRecord'
import { queryRecords } from '@TAF/actions/records/api/queryRecords'
import { useAsyncAction } from '@TAF/hooks/components/useAsyncAction'
import {
  useActiveOrgId,
  useActiveProjectId,
  useProjectCollections,
  useCollectionRecords,
  useActiveCollectionName,
} from '@TAF/state/selectors'
import {
  Box,
  Chip,
  Table,
  Alert,
  Button,
  Dialog,
  TableRow,
  TableCell,
  TableBody,
  TableHead,
  Typography,
  IconButton,
  DialogTitle,
  DialogContent,
  DialogActions,
  TableContainer,
  TablePagination,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'

const formatDataPreview = (data: Record<string, unknown>) => {
  const json = JSON.stringify(data)
  return json.length > 100 ? `${json.slice(0, 100)}...` : json
}

export const ProjectCollectionDetail = () => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [name] = useActiveCollectionName()
  const [collectionsMap] = useProjectCollections()
  const [recordsMap] = useCollectionRecords(name)

  const collection = useMemo(
    () => Object.values(collectionsMap || {}).find((c) => c.name === name),
    [collectionsMap, name]
  )
  const records = useMemo(() => Object.values(recordsMap || {}), [recordsMap])

  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  const [editingRecord, setEditingRecord] = useState<RecordModel | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorText, setEditorText] = useState(`{}`)
  const [editorError, setEditorError] = useState<string>()

  const [deleteTarget, setDeleteTarget] = useState<RecordModel | null>(null)

  const listAction = useAsyncAction()
  const saveAction = useAsyncAction()
  const deleteAction = useAsyncAction()

  const loadRecords = async () => {
    if (!orgId || !projectId || !name) return
    await listAction.run(() =>
      queryRecords({
        orgId,
        projectId,
        collectionName: name,
        query: { limit: rowsPerPage, offset: page * rowsPerPage },
      })
    )
  }

  useEffect(() => {
    loadRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, projectId, name, page, rowsPerPage])

  const onChangePage = (_event: unknown, newPage: number) => setPage(newPage)

  const onChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(Number.parseInt(event.target.value, 10))
    setPage(0)
  }

  const onAddClick = () => {
    setEditingRecord(null)
    setEditorText(`{}`)
    setEditorError(undefined)
    setEditorOpen(true)
  }

  const onEditClick = (record: RecordModel) => {
    setEditingRecord(record)
    setEditorText(JSON.stringify(record.data, null, 2))
    setEditorError(undefined)
    setEditorOpen(true)
  }

  const onEditorClose = () => {
    if (saveAction.loading) return
    setEditorOpen(false)
  }

  const onEditorSave = async () => {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(editorText)
    } catch {
      setEditorError(`Invalid JSON -- please fix before saving.`)
      return
    }
    if (typeof parsed !== `object` || parsed === null || Array.isArray(parsed)) {
      setEditorError(`Record data must be a JSON object.`)
      return
    }
    setEditorError(undefined)

    if (!orgId || !projectId || !name) return

    const result = await saveAction.run(() =>
      upsertRecord({
        orgId,
        projectId,
        collectionName: name,
        data: { id: editingRecord?.id, data: parsed },
      })
    )

    if (result?.error) {
      setEditorError(`Failed to save record. Please try again.`)
      return
    }

    setEditorOpen(false)
    await loadRecords()
  }

  const onDeleteClick = (record: RecordModel) => setDeleteTarget(record)
  const onDeleteCancel = () => setDeleteTarget(null)

  const onDeleteConfirm = async () => {
    if (!orgId || !projectId || !name || !deleteTarget) return
    const result = await deleteAction.run(() =>
      deleteRecord({ orgId, projectId, collectionName: name, id: deleteTarget.id })
    )
    if (!result?.error) setDeleteTarget(null)
  }

  if (!name) return <EmptyState message='Collection not found.' />

  return (
    <Page className='tdsk-project-collection-detail-page'>
      <Box
        sx={{
          display: `flex`,
          alignItems: `center`,
          justifyContent: `space-between`,
          mb: 2,
        }}
      >
        <Box>
          <Typography
            variant='h6'
            sx={{ fontFamily: `monospace` }}
          >
            {name}
          </Typography>
          {collection?.description && (
            <Typography
              variant='body2'
              color='text.secondary'
            >
              {collection.description}
            </Typography>
          )}
          <Box sx={{ display: `flex`, gap: 1, mt: 1 }}>
            <Chip
              size='small'
              variant='outlined'
              color={collection?.schema ? `info` : `default`}
              label={
                collection?.schema ? `${collection.schema.length} fields` : `Schemaless`
              }
            />
            {typeof collection?.recordCount === `number` && (
              <Chip
                size='small'
                variant='outlined'
                label={`${collection.recordCount} records`}
              />
            )}
          </Box>
        </Box>
        <Button
          variant='contained'
          startIcon={<AddIcon />}
          onClick={onAddClick}
        >
          Add Record
        </Button>
      </Box>

      {listAction.error && (
        <Alert
          severity='error'
          sx={{ mb: 2 }}
        >
          {listAction.error}
        </Alert>
      )}
      {deleteAction.error && (
        <Alert
          severity='error'
          sx={{ mb: 2 }}
        >
          {deleteAction.error}
        </Alert>
      )}

      {!listAction.loading && records.length === 0 && (
        <EmptyState message='No records in this collection yet.' />
      )}

      {records.length > 0 && (
        <TableContainer>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Data</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align='right'>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((record) => (
                <TableRow
                  key={record.id}
                  hover
                >
                  <TableCell>
                    <Typography
                      variant='body2'
                      fontFamily='monospace'
                    >
                      {record.id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant='body2'
                      sx={{
                        maxWidth: 400,
                        overflow: `hidden`,
                        textOverflow: `ellipsis`,
                        whiteSpace: `nowrap`,
                      }}
                    >
                      {formatDataPreview(record.data)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant='body2'>
                      {record.createdAt
                        ? new Date(record.createdAt).toLocaleString()
                        : `-`}
                    </Typography>
                  </TableCell>
                  <TableCell align='right'>
                    <IconButton
                      size='small'
                      color='primary'
                      title='Edit record'
                      onClick={() => onEditClick(record)}
                    >
                      <EditIcon fontSize='small' />
                    </IconButton>
                    <IconButton
                      size='small'
                      color='error'
                      title='Delete record'
                      onClick={() => onDeleteClick(record)}
                    >
                      <DeleteIcon fontSize='small' />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component='div'
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={onChangePage}
            rowsPerPageOptions={[10, 25, 50]}
            onRowsPerPageChange={onChangeRowsPerPage}
            count={collection?.recordCount ?? -1}
          />
        </TableContainer>
      )}

      <Dialog
        open={editorOpen}
        onClose={onEditorClose}
        maxWidth='sm'
        fullWidth
      >
        <DialogTitle>{editingRecord ? `Edit Record` : `Add Record`}</DialogTitle>
        <DialogContent>
          <TextInput
            textarea
            fullWidth
            id='record-data-editor'
            minRows={8}
            maxRows={20}
            value={editorText}
            hasError={Boolean(editorError)}
            helperText={editorError || `Record data as a JSON object`}
            onChange={(e) => setEditorText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={onEditorClose}
            disabled={saveAction.loading}
          >
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={onEditorSave}
            disabled={saveAction.loading}
          >
            {saveAction.loading ? `Saving...` : `Save`}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDelete
        title='Delete Record?'
        open={Boolean(deleteTarget)}
        itemName={deleteTarget?.id || `this record`}
        deleting={deleteAction.loading}
        onConfirm={onDeleteConfirm}
        warnText='This will permanently delete this record. This action cannot be undone.'
        onCancel={onDeleteCancel}
      />
    </Page>
  )
}

export default ProjectCollectionDetail
