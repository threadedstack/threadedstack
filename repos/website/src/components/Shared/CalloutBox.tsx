import Alert from '@mui/material/Alert'
import type { AlertColor } from '@mui/material/Alert'

type Props = {
  severity?: AlertColor
  children: React.ReactNode
}

const severityMap: Record<string, AlertColor> = {
  note: 'info',
  warning: 'warning',
  tip: 'success',
}

const CalloutBox = ({ severity = 'info', children }: Props) => (
  <Alert
    severity={severityMap[severity] || severity}
    sx={{ my: 2, borderRadius: 2 }}
  >
    {children}
  </Alert>
)

export default CalloutBox
