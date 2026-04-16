import { Alert as MuiAlert, AlertTitle } from '@mui/material'

type TGuiAlertProps = {
  variant?: 'info' | 'warning' | 'error' | 'success'
  title?: string
  children?: React.ReactNode
}

export function GuiAlert({ variant = 'info', title, children }: TGuiAlertProps) {
  return (
    <MuiAlert
      severity={variant}
      sx={{ my: 1 }}
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      {children}
    </MuiAlert>
  )
}
