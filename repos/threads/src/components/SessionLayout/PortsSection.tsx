import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Add from '@mui/icons-material/Add'
import Tooltip from '@mui/material/Tooltip'
import Close from '@mui/icons-material/Close'
import TextField from '@mui/material/TextField'
import { MonoFont } from '@TTH/constants/values'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Refresh from '@mui/icons-material/Refresh'
import OpenInNew from '@mui/icons-material/OpenInNew'
import { useSandboxPorts } from '@TTH/state/selectors'
import { useState, useEffect, useCallback } from 'react'
import { loadPorts } from '@TTH/actions/sandboxes/loadPorts'
import { exposePort } from '@TTH/actions/sandboxes/exposePort'
import { removePort } from '@TTH/actions/sandboxes/removePort'

export type TPortsSectionProps = {
  orgId: string
  projectId: string
  sandboxId: string
  instanceId: string
  portUrlTemplate?: string
}

const buildUrl = (template: string | undefined, port: number): string | null => {
  if (!template) return null
  return template.replace(`{port}`, String(port))
}

type TPortRowProps = {
  port: string
  protocol: string
  url: string | null
  onRemove: () => void
}

const PortRow = (props: TPortRowProps) => {
  const { port, protocol, url, onRemove } = props

  return (
    <Box
      sx={{
        py: `5px`,
        display: `flex`,
        alignItems: `center`,
        borderBottom: `1px dashed`,
        borderColor: `divider`,
        justifyContent: `space-between`,
      }}
    >
      <Box sx={{ display: `flex`, alignItems: `center`, gap: `6px` }}>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 600,
            fontFamily: MonoFont,
          }}
        >
          {port}
        </Typography>
        <Typography
          sx={{
            fontSize: 10,
            fontFamily: MonoFont,
            color: `text.secondary`,
          }}
        >
          {protocol}
        </Typography>
      </Box>
      <Box sx={{ display: `flex`, alignItems: `center`, gap: 0 }}>
        {url && (
          <Tooltip title='Open in browser'>
            <IconButton
              size='small'
              component='a'
              href={url}
              target='_blank'
              rel='noopener'
              sx={{ p: `2px` }}
            >
              <OpenInNew sx={{ fontSize: 13, color: `primary.main` }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title='Remove port'>
          <IconButton
            size='small'
            onClick={onRemove}
            sx={{ p: `2px` }}
          >
            <Close sx={{ fontSize: 13, color: `text.secondary` }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}

type TDetectedRowProps = {
  port: number
  onExpose: () => void
}

const DetectedRow = (props: TDetectedRowProps) => {
  const { port, onExpose } = props

  return (
    <Box
      sx={{
        py: `4px`,
        display: `flex`,
        alignItems: `center`,
        justifyContent: `space-between`,
      }}
    >
      <Typography
        sx={{
          fontSize: 11.5,
          fontFamily: MonoFont,
          color: `text.secondary`,
        }}
      >
        {port}
      </Typography>
      <Tooltip title='Expose this port'>
        <IconButton
          size='small'
          onClick={onExpose}
          sx={{ p: `2px` }}
        >
          <Add sx={{ fontSize: 13, color: `primary.main` }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

export const PortsSection = (props: TPortsSectionProps) => {
  const { orgId, projectId, sandboxId, instanceId, portUrlTemplate } = props
  const [sandboxPorts] = useSandboxPorts()
  const [loading, setLoading] = useState(false)
  const [portInput, setPortInput] = useState(``)
  const [addingPort, setAddingPort] = useState(false)

  const portsData = sandboxPorts.get(instanceId)
  const exposed = portsData?.exposed ?? {}
  const detected = portsData?.detected ?? []
  const exposedKeys = Object.keys(exposed)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      await loadPorts(orgId, projectId, sandboxId, instanceId)
    } finally {
      setLoading(false)
    }
  }, [orgId, projectId, sandboxId, instanceId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const onExpose = useCallback(
    async (port: number) => {
      try {
        await exposePort(orgId, projectId, sandboxId, instanceId, port)
      } catch (err) {
        toast.error(`Failed to expose port ${port}`, {
          description: (err as Error).message,
        })
      }
    },
    [orgId, projectId, sandboxId, instanceId]
  )

  const onRemove = useCallback(
    async (port: number) => {
      try {
        await removePort(orgId, projectId, sandboxId, instanceId, port)
      } catch (err) {
        toast.error(`Failed to remove port ${port}`, {
          description: (err as Error).message,
        })
      }
    },
    [orgId, projectId, sandboxId, instanceId]
  )

  const onAddSubmit = useCallback(async () => {
    const num = Number(portInput)
    if (!Number.isInteger(num) || num < 1 || num > 65535) {
      if (portInput) toast.error(`Invalid port: must be 1-65535`)
      return
    }
    setPortInput(``)
    setAddingPort(false)
    await onExpose(num)
  }, [portInput, onExpose])

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 0.5 }}>
      {/* Header actions */}
      <Box sx={{ display: `flex`, justifyContent: `flex-end`, gap: 0, mt: -0.5 }}>
        <Tooltip title='Add port'>
          <IconButton
            size='small'
            onClick={() => setAddingPort(!addingPort)}
            sx={{ p: `2px` }}
          >
            <Add sx={{ fontSize: 14, color: `text.secondary` }} />
          </IconButton>
        </Tooltip>
        <Tooltip title='Refresh ports'>
          <IconButton
            size='small'
            onClick={refresh}
            disabled={loading}
            sx={{ p: `2px` }}
          >
            <Refresh
              sx={{
                fontSize: 14,
                color: `text.secondary`,
                ...(loading && {
                  animation: `spin 1s linear infinite`,
                  '@keyframes spin': {
                    from: { transform: `rotate(0deg)` },
                    to: { transform: `rotate(360deg)` },
                  },
                }),
              }}
            />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Add port input */}
      {addingPort && (
        <Box sx={{ display: `flex`, gap: 0.5, alignItems: `center`, mb: 0.5 }}>
          <TextField
            size='small'
            autoFocus
            placeholder='Port'
            value={portInput}
            onChange={(e) => setPortInput(e.target.value.replace(/\D/g, ``))}
            onKeyDown={(e) => {
              if (e.key === `Enter`) onAddSubmit()
              if (e.key === `Escape`) setAddingPort(false)
            }}
            sx={{
              flex: 1,
              '& .MuiInputBase-input': {
                fontSize: 11,
                fontFamily: MonoFont,
                py: `4px`,
                px: `8px`,
              },
            }}
          />
          <Tooltip title='Expose'>
            <IconButton
              size='small'
              onClick={onAddSubmit}
              disabled={!portInput}
              sx={{ p: `2px` }}
            >
              <Add sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Exposed ports */}
      {exposedKeys.length > 0 && (
        <Box sx={{ display: `flex`, flexDirection: `column` }}>
          {exposedKeys.map((port) => (
            <PortRow
              key={port}
              port={port}
              protocol={exposed[port]!.protocol}
              url={buildUrl(portUrlTemplate, Number(port))}
              onRemove={() => onRemove(Number(port))}
            />
          ))}
        </Box>
      )}

      {/* Detected (unexposed) ports */}
      {detected.length > 0 && (
        <Box sx={{ mt: exposedKeys.length > 0 ? 1 : 0 }}>
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: `0.08em`,
              color: `text.secondary`,
              textTransform: `uppercase`,
              mb: `4px`,
            }}
          >
            Detected
          </Typography>
          {detected.map((d) => (
            <DetectedRow
              key={d.port}
              port={d.port}
              onExpose={() => onExpose(d.port)}
            />
          ))}
        </Box>
      )}

      {/* Empty state */}
      {exposedKeys.length === 0 && detected.length === 0 && !loading && (
        <Typography sx={{ fontSize: 11, color: `text.secondary`, fontStyle: `italic` }}>
          No ports detected
        </Typography>
      )}
    </Box>
  )
}
