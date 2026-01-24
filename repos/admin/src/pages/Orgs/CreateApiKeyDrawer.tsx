import type { TApiKeyScope } from '@tdsk/domain'

import { useState } from 'react'
import { createApiKey } from '@TAF/actions/apiKeys'
import { ApiKeyScopes } from '@TAF/constants/values'
import { Drawer, ClipboardCopy, Button } from '@tdsk/components'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import {
  Box,
  Paper,
  Alert,
  Select,
  MenuItem,
  Checkbox,
  FormGroup,
  TextField,
  InputLabel,
  Typography,
  FormControl,
  FormControlLabel,
} from '@mui/material'

export type TCreateApiKeyDrawer = {
  orgId: string
  projectId?: string
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export const CreateApiKeyDrawer = (props: TCreateApiKeyDrawer) => {
  const { open, orgId, projectId, onClose: onCloseCB, onSuccess: onSuccessCB } = props

  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<TApiKeyScope[]>([`read`])
  const [expiresIn, setExpiresIn] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)

  const onScopeChange = (scope: TApiKeyScope) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    )
  }

  const onSubmit = async () => {
    if (!name.trim()) {
      setError(`API key name is required`)
      return
    }

    if (scopes.length === 0) {
      setError(`At least one scope is required`)
      return
    }

    setLoading(true)
    setError(null)

    let expiresAt: Date | undefined
    if (expiresIn) {
      const days = Number.parseInt(expiresIn, 10)
      if (!isNaN(days) && days > 0) {
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      }
    }

    const result = await createApiKey({
      name: name.trim(),
      orgId: projectId ? undefined : orgId,
      projectId,
      scopes: scopes.join(','),
      expiresAt,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    if (result.data?.key) {
      setGeneratedKey(result.data.key)
    }
  }

  const onClose = () => {
    // Only allow closing if we haven't generated a key yet
    // or if the user has explicitly acknowledged the key
    if (generatedKey) {
      onSuccessCB?.()
    }
    setName('')
    setScopes(['read'])
    setExpiresIn('')
    setError(null)
    setGeneratedKey(null)
    onCloseCB?.()
  }

  const onDone = () => {
    onSuccessCB?.()
    onClose()
  }

  if (generatedKey) {
    return (
      <Drawer
        open={open}
        onClose={() => {}}
        title='API Key Generated'
        actions={
          <Button
            onClick={onDone}
            variant='contained'
            color='primary'
          >
            Done
          </Button>
        }
      >
        <Alert
          severity='warning'
          sx={{ mb: 3 }}
        >
          <Typography variant='body2'>
            Make sure to copy your API key now. You won't be able to see it again!
          </Typography>
        </Alert>

        <Paper
          variant='outlined'
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            backgroundColor: 'grey.50',
          }}
        >
          <Typography
            variant='body2'
            fontFamily='monospace'
            sx={{
              flex: 1,
              wordBreak: 'break-all',
              fontSize: '0.875rem',
            }}
          >
            {generatedKey}
          </Typography>
          <ClipboardCopy value={generatedKey} />
        </Paper>

        <Typography
          variant='caption'
          color='text.secondary'
          sx={{ display: 'block', mt: 2 }}
        >
          Use this key in the Authorization header:{' '}
          <code>
            Authorization: Bearer {'{'}your_key{'}'}
          </code>
        </Typography>
      </Drawer>
    )
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title='Generate API Key'
      actions={
        <>
          <Button
            color='error'
            onClick={onClose}
          >
            Cancel
          </Button>
          <LoadingButton
            onClick={onSubmit}
            variant='contained'
            loading={loading}
            disabled={!name.trim() || scopes.length === 0}
            loadingText='Generating...'
          >
            Generate Key
          </LoadingButton>
        </>
      }
    >
      {error && (
        <ErrorAlert
          message={error}
          onClose={() => setError(null)}
          sx={{ mb: 2 }}
        />
      )}

      <TextField
        autoFocus
        margin='dense'
        label='Key Name'
        fullWidth
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder='e.g., Production API Key'
        helperText='A descriptive name to identify this key'
        sx={{ mb: 2 }}
      />

      <Box sx={{ mb: 2 }}>
        <Typography
          variant='subtitle2'
          gutterBottom
        >
          Scopes
        </Typography>
        <FormGroup row>
          {ApiKeyScopes.map((scope) => (
            <FormControlLabel
              key={scope}
              control={
                <Checkbox
                  checked={scopes.includes(scope)}
                  onChange={() => onScopeChange(scope)}
                />
              }
              label={
                <Box>
                  <Typography variant='body2'>{scope}</Typography>
                  <Typography
                    variant='caption'
                    color='text.secondary'
                  >
                    {scope === 'read' && 'Read-only access to resources'}
                    {scope === 'write' && 'Create and update resources'}
                    {scope === 'admin' && 'Full administrative access'}
                  </Typography>
                </Box>
              }
            />
          ))}
        </FormGroup>
      </Box>

      <FormControl
        fullWidth
        margin='dense'
      >
        <InputLabel>Expiration</InputLabel>
        <Select
          value={expiresIn}
          onChange={(e) => setExpiresIn(e.target.value)}
          label='Expiration'
        >
          <MenuItem value=''>Never expires</MenuItem>
          <MenuItem value='7'>7 days</MenuItem>
          <MenuItem value='30'>30 days</MenuItem>
          <MenuItem value='90'>90 days</MenuItem>
          <MenuItem value='180'>180 days</MenuItem>
          <MenuItem value='365'>1 year</MenuItem>
        </Select>
      </FormControl>
    </Drawer>
  )
}

export default CreateApiKeyDrawer
