import { Alert } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

export type TErrorAlert = {
  message: string
  onClose?: () => void
  sx?: SxProps<Theme>
}

export const ErrorAlert = ({ message, onClose, sx }: TErrorAlert) => {
  return (
    <Alert
      severity='error'
      onClose={onClose}
      sx={sx}
    >
      {message}
    </Alert>
  )
}

export default ErrorAlert
