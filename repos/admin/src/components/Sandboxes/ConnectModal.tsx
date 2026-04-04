import type { Sandbox, TSandboxConnectResponse, TSandboxSession } from '@tdsk/domain'

import { useState, useEffect } from 'react'
import { clipboard } from '@tdsk/components'
import { getSandboxSessions } from '@TAF/actions/sandboxes/api/getSandboxSessions'
import {
  Check as CheckIcon,
  People as SessionsIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material'
import {
  Box,
  Chip,
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
  connectData: TSandboxConnectResponse | null
}

export const ConnectModal = ({
  orgId,
  open,
  stopping,
  sandbox,
  connectData,
  onClose,
  onStop,
}: TConnectModal) => {
  const [copied, setCopied] = useState<string | null>(null)
  const [sessions, setSessions] = useState<TSandboxSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)

  useEffect(() => {
    if (!open || !sandbox?.id || !orgId) {
      setSessions([])
      return
    }

    let cancelled = false
    const fetchSessions = async () => {
      setLoadingSessions(true)
      const result = await getSandboxSessions({ orgId, sandboxId: sandbox.id })
      if (!cancelled) {
        setSessions(result.data || [])
        setLoadingSessions(false)
      }
    }

    fetchSessions()
    return () => {
      cancelled = true
    }
  }, [open, sandbox?.id, orgId])

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
  const vscodeConfig = `Host sandbox-*\n  ProxyCommand tsa proxy %h\n  User sandbox\n  StrictHostKeyChecking no\n  UserKnownHostsFile /dev/null`

  return (
    <Dialog
      fullWidth
      open={open}
      maxWidth='sm'
      onClose={onClose}
    >
      <DialogTitle>Connect to &quot;{sandbox?.name || 'Sandbox'}&quot;</DialogTitle>
      <DialogContent>
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
            {loadingSessions ? (
              <CircularProgress
                size={12}
                sx={{ ml: 'auto' }}
              />
            ) : (
              <Chip
                size='small'
                variant='outlined'
                sx={{ ml: 'auto' }}
                icon={<SessionsIcon sx={{ fontSize: 14 }} />}
                label={`${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
              />
            )}
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
            {vscodeConfig}
          </Typography>
          <IconButton
            size='small'
            sx={{ position: 'absolute', top: 4, right: 4 }}
            onClick={() => copyToClipboard(vscodeConfig, 'vscode')}
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
