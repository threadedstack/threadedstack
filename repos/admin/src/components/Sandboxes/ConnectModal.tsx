import type { Sandbox, TSandboxConnectResponse, TSandboxSession } from '@tdsk/domain'

import { useState } from 'react'
import { clipboard } from '@tdsk/components'
import { useUser } from '@TAF/state/selectors'
import { VSCodeSSHConfig } from '@TAF/constants/monaco'
import { ESandboxRuntime, ESandboxSessionVisibility } from '@tdsk/domain'
import {
  Lock as LockIcon,
  Check as CheckIcon,
  Public as PublicIcon,
  People as SessionsIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material'
import {
  Box,
  Chip,
  Alert,
  Table,
  Button,
  Dialog,
  Divider,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
  IconButton,
  Typography,
  DialogTitle,
  DialogActions,
  DialogContent,
  TableContainer,
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

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `just now`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export const ConnectModal = (props: TConnectModal) => {
  const { open, orgId, onStop, onClose, sandbox, stopping, sessions, connectData } = props

  const [user] = useUser()
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
          </Box>
        )}

        {/* Active Sessions */}
        {sessions.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant='subtitle2'
              sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <SessionsIcon sx={{ fontSize: 16 }} />
              Active Sessions ({sessions.length})
            </Typography>
            <TableContainer sx={{ borderRadius: 1, bgcolor: 'action.hover' }}>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, py: 0.75 }}>Session</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 0.75 }}>Owner</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 0.75 }}>Visibility</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 0.75 }}>Connected</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 0.75, width: 40 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.map((s) => {
                    const isOwner = user?.id === s.userId
                    const isPublic = s.visibility === ESandboxSessionVisibility.public
                    return (
                      <TableRow key={s.sessionId}>
                        <TableCell
                          sx={{ py: 0.75, fontFamily: 'monospace', fontSize: '0.8rem' }}
                        >
                          {s.sessionId.slice(0, 12)}
                        </TableCell>
                        <TableCell sx={{ py: 0.75, fontSize: '0.8rem' }}>
                          {s.userId.slice(0, 16)}
                          {isOwner && (
                            <Typography
                              component='span'
                              variant='caption'
                              color='primary'
                              sx={{ ml: 0.5 }}
                            >
                              (you)
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ py: 0.75 }}>
                          <Chip
                            size='small'
                            variant='outlined'
                            label={s.visibility}
                            color={isPublic ? 'info' : 'default'}
                            icon={
                              isPublic ? (
                                <PublicIcon sx={{ fontSize: 14 }} />
                              ) : (
                                <LockIcon sx={{ fontSize: 14 }} />
                              )
                            }
                            sx={{
                              height: 22,
                              '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' },
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ py: 0.75, fontSize: '0.8rem' }}>
                          {relativeTime(s.connectedAt)}
                        </TableCell>
                        <TableCell sx={{ py: 0.75 }}>
                          {isOwner && (
                            <IconButton
                              size='small'
                              title='Copy session ID'
                              onClick={() => copyToClipboard(s.sessionId, s.sessionId)}
                            >
                              {copied === s.sessionId ? (
                                <CheckIcon
                                  fontSize='small'
                                  color='success'
                                />
                              ) : (
                                <CopyIcon sx={{ fontSize: 14 }} />
                              )}
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
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
