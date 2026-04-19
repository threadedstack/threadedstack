import type { TCommand } from '@TTH/types'

import StopIcon from '@mui/icons-material/Stop'
import RefreshIcon from '@mui/icons-material/Refresh'
import RestartAltIcon from '@mui/icons-material/RestartAlt'

export const ShellSessionsStorageKey = `shell_sessions`

export const CommandConfig: Record<
  TCommand,
  {
    label: string
    icon: React.ReactNode
    color: 'error' | 'warning'
    dialogTitle: string
    dialogText: string
  }
> = {
  stop: {
    label: `Stop`,
    icon: <StopIcon sx={{ fontSize: 18 }} />,
    color: `error`,
    dialogTitle: `Stop Sandbox`,
    dialogText: `Stop this sandbox session? The pod will be shut down.`,
  },
  restart: {
    label: `Restart`,
    icon: <RestartAltIcon sx={{ fontSize: 18 }} />,
    color: `warning`,
    dialogTitle: `Restart Sandbox`,
    dialogText: `Restart this sandbox? Your session history will be preserved.`,
  },
  recreate: {
    label: `Recreate`,
    icon: <RefreshIcon sx={{ fontSize: 18 }} />,
    color: `warning`,
    dialogTitle: `Recreate Sandbox`,
    dialogText: `Recreate this sandbox from scratch? All session history will be lost.`,
  },
}
