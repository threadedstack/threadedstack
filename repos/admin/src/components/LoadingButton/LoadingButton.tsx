import type { ButtonProps } from '@mui/material'
import { LoadingButton as SharedLoadingButton } from '@tdsk/components'

export type TLoadingButton = ButtonProps & {
  loading?: boolean
  loadingText?: string
}

/**
 * LoadingButton - Wrapper around @tdsk/components LoadingButton
 * Provides a simple loading state button with optional loading text
 */
export const LoadingButton = ({
  loading = false,
  loadingText,
  children,
  disabled,
  ...props
}: TLoadingButton) => {
  const displayText = loading && loadingText ? loadingText : children

  return (
    <SharedLoadingButton
      disabled={disabled || loading}
      loading={loading}
      {...props}
    >
      {displayText}
    </SharedLoadingButton>
  )
}

export default LoadingButton
