import type { TEndpointType } from '@tdsk/domain'

import { toast } from 'sonner'
import SaveIcon from '@mui/icons-material/Save'
import { vep } from '@TAF/utils/endpoints/validators'
import { capitalize } from '@keg-hub/jsutils/capitalize'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { AgentSection } from '@TAF/components/Agents/AgentSection'
import { TextInput, SelectInput, SwitchInput } from '@tdsk/components'
import { EndpointTypeOpts, HttpMethodOps } from '@TAF/constants/values'
import { updateEndpoint } from '@TAF/actions/endpoints/api/updateEndpoint'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import { useUnsavedChangesGuard } from '@TAF/hooks/endpoints/useUnsavedChangesGuard'
import {
  Box,
  Alert,
  Button,
  Dialog,
  Typography,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  useActiveOrgId,
  useActiveEndpoint,
  useActiveProjectId,
  useEndpointTabsDisabled,
} from '@TAF/state/selectors'

const EndpointTab = () => {
  const [orgId] = useActiveOrgId()
  const [endpoint] = useActiveEndpoint()
  const [projectId] = useActiveProjectId()
  const [, setTabsDisabled] = useEndpointTabsDisabled()

  const [name, setName] = useState(endpoint?.name ?? ``)
  const [type, setType] = useState(endpoint?.type ?? ``)
  const [method, setMethod] = useState(endpoint?.method ?? `GET`)
  const [path, setPath] = useState(endpoint?.path ?? ``)
  const [isPublic, setIsPublic] = useState(endpoint?.public ?? false)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [pendingType, setPendingType] = useState<string | null>(null)
  const [typeDialogOpen, setTypeDialogOpen] = useState(false)

  useEffect(() => {
    if (!endpoint) return

    setName(endpoint.name ?? ``)
    setType(endpoint.type ?? ``)
    setMethod(endpoint.method ?? `GET`)
    setPath(endpoint.path ?? ``)
    setIsPublic(endpoint.public ?? false)
    setError(null)
    setTabsDisabled(false)
  }, [endpoint?.id])

  const hasChanges = useMemo(() => {
    if (!endpoint) return false

    return (
      name !== (endpoint.name ?? ``) ||
      type !== (endpoint.type ?? ``) ||
      method !== (endpoint.method ?? `GET`) ||
      path !== (endpoint.path ?? ``) ||
      isPublic !== (endpoint.public ?? false)
    )
  }, [endpoint, name, type, method, path, isPublic])

  const { showDialog, onConfirmLeave, onCancelLeave } = useUnsavedChangesGuard(hasChanges)

  const onTypeChange = useCallback(
    (newType: string) => {
      if (endpoint?.id && newType !== type) {
        setPendingType(newType)
        setTypeDialogOpen(true)
      } else {
        setType(newType)
      }
    },
    [endpoint?.id, type]
  )

  const onConfirmTypeChange = useCallback(() => {
    if (pendingType) {
      setType(pendingType)
      setTabsDisabled(true)
    }
    setPendingType(null)
    setTypeDialogOpen(false)
  }, [pendingType, setTabsDisabled])

  const onCancelTypeChange = useCallback(() => {
    setPendingType(null)
    setTypeDialogOpen(false)
  }, [])

  const onSave = useCallback(async () => {
    if (!endpoint?.id || !orgId || !projectId) {
      setError(`Unable to save: missing context. Please reload the page.`)
      return
    }

    const errors = vep.shared(name, path)
    if (errors) {
      setError(errors)
      return
    }

    setError(null)
    setLoading(true)

    const result = await updateEndpoint({
      orgId,
      projectId,
      id: endpoint.id,
      data: {
        name,
        type: type as TEndpointType,
        method,
        path,
        public: isPublic,
      },
    })

    setLoading(false)

    if (result?.error) {
      setError(result.error?.message || `Failed to update endpoint`)
      return
    }

    setTabsDisabled(false)
    toast.success(`Endpoint saved`)
  }, [
    endpoint?.id,
    orgId,
    projectId,
    name,
    type,
    method,
    path,
    isPublic,
    setTabsDisabled,
  ])

  if (!endpoint) return null

  return (
    <Box>
      <AgentSection title='Endpoint Details'>
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
          <TextInput
            required
            fullWidth
            id='endpoint-name'
            label='Endpoint Name'
            value={name}
            placeholder='Enter endpoint name'
            onChange={(e) => setName(e.target.value)}
          />

          <SelectInput
            required
            id='endpoint-type'
            label='Endpoint Type'
            items={EndpointTypeOpts}
            value={type}
            onChange={(e) => onTypeChange(e.target.value as string)}
          />

          <SelectInput
            required
            id='endpoint-method'
            label='HTTP Method'
            items={HttpMethodOps}
            value={method?.toLowerCase()}
            onChange={(e) => setMethod(e.target.value as string)}
          />

          <TextInput
            required
            fullWidth
            id='endpoint-path'
            label='Endpoint Path'
            value={path}
            placeholder='/custom/path'
            onChange={(e) => setPath(e.target.value)}
          />

          <SwitchInput
            id='public-endpoint'
            label='Public Endpoint'
            checked={isPublic}
            onChange={(_e, checked) => setIsPublic(checked)}
          />
          <Box sx={{ ml: 4, mt: -1 }}>
            <Alert
              severity='info'
              sx={{ fontSize: `0.875rem` }}
            >
              {isPublic ? `Accessible without authentication` : `Requires authentication`}
            </Alert>
          </Box>
        </Box>
      </AgentSection>

      {error && (
        <Box sx={{ mb: 2 }}>
          <ErrorAlert
            message={error}
            onClose={() => setError(null)}
          />
        </Box>
      )}

      <Box sx={{ display: `flex`, justifyContent: `flex-end` }}>
        <LoadingButton
          color='primary'
          variant='contained'
          onClick={onSave}
          loading={loading}
          Icon={<SaveIcon />}
          disabled={!hasChanges}
          loadingText='Saving...'
        >
          Save
        </LoadingButton>
      </Box>

      <Dialog
        open={showDialog}
        onClose={onCancelLeave}
      >
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <Typography variant='body2'>
            You have unsaved changes. Discard and continue?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancelLeave}>Stay</Button>
          <Button
            variant='contained'
            color='error'
            onClick={onConfirmLeave}
          >
            Discard
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={typeDialogOpen}
        onClose={onCancelTypeChange}
      >
        <DialogTitle>Change Endpoint Type?</DialogTitle>
        <DialogContent>
          <Typography variant='body2'>
            Changing from {capitalize(type)} to {capitalize(pendingType ?? ``)} will
            unlink the current configuration. Any unsaved changes on the configuration tab
            will also be discarded. Are you sure?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancelTypeChange}>Cancel</Button>
          <Button
            variant='contained'
            onClick={onConfirmTypeChange}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default EndpointTab
