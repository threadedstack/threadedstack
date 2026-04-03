import type { TProxyEndpointConfig } from '@tdsk/domain'

import { toast } from 'sonner'
import SaveIcon from '@mui/icons-material/Save'
import { AgentSection } from '@TAF/components/Agents/AgentSection'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { fetchSecrets } from '@TAF/actions/secrets/api/fetchSecrets'
import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { updateEndpoint } from '@TAF/actions/endpoints/api/updateEndpoint'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import { EndpointProxy } from '@TAF/components/Endpoints/Proxy/EndpointProxy'
import { useUnsavedChangesGuard } from '@TAF/hooks/endpoints/useUnsavedChangesGuard'
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
} from '@mui/material'
import {
  useActiveOrgId,
  useProjectSecrets,
  useActiveEndpoint,
  useActiveProjectId,
} from '@TAF/state/selectors'

export const ProxyConfigTab = () => {
  const [orgId] = useActiveOrgId()
  const [endpoint] = useActiveEndpoint()
  const [projectId] = useActiveProjectId()
  const [secretsMap] = useProjectSecrets()

  const validationErrorRef = useRef<string | null>(null)
  const configRef = useRef<TProxyEndpointConfig | null>(null)

  const initializedRef = useRef(false)
  const [loading, setLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { showDialog, onConfirmLeave, onCancelLeave } = useUnsavedChangesGuard(isDirty)

  const availableSecrets = useMemo(
    () => (secretsMap ? Object.values(secretsMap) : []),
    [secretsMap]
  )

  useEffect(() => {
    if (orgId && projectId) {
      fetchSecrets({ orgId, projectId })
    }
  }, [orgId, projectId])

  // Reset dirty state when endpoint changes
  useEffect(() => {
    setIsDirty(false)
    initializedRef.current = false
  }, [endpoint?.id])

  const onConfigChange = useCallback((config: TProxyEndpointConfig | null) => {
    configRef.current = config
    // Skip the initial config hydration from the endpoint data
    if (initializedRef.current) {
      setIsDirty(true)
    } else {
      initializedRef.current = true
    }
  }, [])

  const onValidate = useCallback((err: string | null) => {
    validationErrorRef.current = err
  }, [])

  const onSave = useCallback(async () => {
    if (!endpoint?.id || !orgId || !projectId) {
      setError(`Unable to save: missing context. Please reload the page.`)
      return
    }

    if (validationErrorRef.current) {
      setError(validationErrorRef.current)
      return
    }

    if (!configRef.current) {
      setError(`Proxy configuration is missing`)
      return
    }

    setError(null)
    setLoading(true)

    const result = await updateEndpoint({
      orgId,
      projectId,
      id: endpoint.id,
      data: { options: configRef.current },
    })

    setLoading(false)

    if (result?.error) {
      setError(result.error?.message || `Failed to update proxy configuration`)
      return
    }

    setIsDirty(false)
    toast.success(`Proxy configuration saved`)
  }, [endpoint?.id, orgId, projectId])

  if (!endpoint) return null

  return (
    <Box>
      <AgentSection title='Proxy Configuration'>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <ErrorAlert
              message={error}
              onClose={() => setError(null)}
            />
          )}

          <EndpointProxy
            endpoint={endpoint}
            loading={loading}
            onValidate={onValidate}
            onConfigChange={onConfigChange}
            availableSecrets={availableSecrets}
          />
        </Box>
      </AgentSection>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <LoadingButton
          color='primary'
          variant='contained'
          onClick={onSave}
          loading={loading}
          Icon={<SaveIcon />}
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
    </Box>
  )
}
