import { Button } from '@mui/material'
import type { ButtonProps } from '@mui/material'

export type TLoadingButton = ButtonProps & {
  loading?: boolean
  loadingText?: string
}

export const LoadingButton = ({
  loading = false,
  loadingText,
  children,
  disabled,
  ...props
}: TLoadingButton) => {
  const displayText = loading && loadingText ? loadingText : children

  return (
    <Button
      disabled={disabled || loading}
      {...props}
    >
      {displayText}
    </Button>
  )
}

export default LoadingButton
