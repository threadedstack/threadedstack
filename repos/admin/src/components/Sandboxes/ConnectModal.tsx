import type { Sandbox, TSandboxConnectResponse, TSandboxSession } from '@tdsk/domain'

import { useState } from 'react'
import { clipboard } from '@tdsk/components'
import { ESandboxRuntime } from '@tdsk/domain'
import { VSCodeSSHConfig } from '@TAF/constants/monaco'
import {
  Check as CheckIcon,
  People as SessionsIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material'
import {
  Box,
  Chip,
  Alert,
  Button,
  Dialog,
  Divider,
  IconButton,
  Typography,
  DialogTitle,
  DialogActions,
  DialogContent,
  CircularProgress,
} from '@mui/material'

export type TConnectModal = {
  orgId: string
  open: boolean
  stopping?: boolean
  onStop: () => void
  onClose: () => void
  sandbox: Sandbox | null
  sessions: TSandboxSession[]
  connectData: TSandboxConnectResponse | null
}

export const ConnectModal = (props: TConnectModal) => {
  const { open, orgId, onStop, onClose, sandbox, stopping, sessions, connectData } = props

  const [copied, setCopied] = useState<string | null>(null)

  const linkedProviders = sandbox?.providers || []
  const sandboxRuntime = sandbox?.config?.runtime
  const isCustomRuntime = sandboxRuntime === ESandboxRuntime.custom
  const hasNoProvider = linkedProviders.length === 0 && !isCustomRuntime

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await clipboard.copy({
        content: text,
        callback: () => {
          setCopied(key)
          setTimeout(() => setCopied(null), 2000)
        },
      })
    } catch {
      setCopied(null)
    }
  }

  const sshCommand = connectData?.command || `tsa ssh ${sandbox?.id || ''}`

  return (
    <Dialog
      fullWidth
      open={open}
      maxWidth='sm'
      onClose={onClose}
    >
      <DialogTitle>Connect to &quot;{sandbox?.name || 'Sandbox'}&quot;</DialogTitle>
      <DialogContent>
        {/* Provider Warning */}
        {hasNoProvider && (
          <Alert
            severity='warning'
            sx={{ mb: 2 }}
          >
            No provider linked. The AI tool may fail to authenticate. Link a provider in
            sandbox settings.
          </Alert>
        )}

        {/* Pod Info */}
        {connectData?.podName && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Chip
              label='Running'
              size='small'
              color='success'
              variant='outlined'
            />
            <Typography
              variant='caption'
              color='text.secondary'
            >
              Pod: {connectData.podName}
            </Typography>
            <Chip
              size='small'
              variant='outlined'
              sx={{ ml: 'auto' }}
              icon={<SessionsIcon sx={{ fontSize: 14 }} />}
              label={`${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
            />
          </Box>
        )}

        <Typography
          variant='subtitle2'
          sx={{ mb: 1 }}
        >
          SSH Command
        </Typography>
        <Box
          sx={{
            px: 2,
            py: 1,
            mb: 3,
            display: 'flex',
            borderRadius: 1,
            alignItems: 'center',
            bgcolor: 'action.hover',
            fontFamily: 'monospace',
          }}
        >
          <Typography
            variant='body2'
            sx={{ fontFamily: 'monospace', flex: 1 }}
          >
            {sshCommand}
          </Typography>
          <IconButton
            size='small'
            onClick={() => copyToClipboard(sshCommand, 'ssh')}
          >
            {copied === 'ssh' ? (
              <CheckIcon
                fontSize='small'
                color='success'
              />
            ) : (
              <CopyIcon fontSize='small' />
            )}
          </IconButton>
        </Box>

        <Typography
          variant='subtitle2'
          sx={{ mb: 1 }}
        >
          VS Code Remote SSH Config
        </Typography>
        <Box
          sx={{
            px: 2,
            py: 1,
            mb: 2,
            borderRadius: 1,
            position: 'relative',
            bgcolor: 'action.hover',
          }}
        >
          <Typography
            variant='body2'
            component='pre'
            sx={{ fontFamily: 'monospace', whiteSpace: 'pre', m: 0, fontSize: '0.8rem' }}
          >
            {VSCodeSSHConfig}
          </Typography>
          <IconButton
            size='small'
            sx={{ position: 'absolute', top: 4, right: 4 }}
            onClick={() => copyToClipboard(VSCodeSSHConfig, 'vscode')}
          >
            {copied === 'vscode' ? (
              <CheckIcon
                fontSize='small'
                color='success'
              />
            ) : (
              <CopyIcon fontSize='small' />
            )}
          </IconButton>
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 1.5 }}>
        <Button
          size='small'
          color='error'
          onClick={onStop}
          variant='outlined'
          disabled={stopping || !connectData?.podName}
          startIcon={stopping ? <CircularProgress size={14} /> : undefined}
        >
          {stopping ? 'Stopping...' : 'Stop Sandbox'}
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
