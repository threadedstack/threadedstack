import type { TLoadingButton } from '@tdsk/components'
import { LoadingButton as SharedLoadingButton } from '@tdsk/components'

export type TLoadButton = TLoadingButton & {
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
}: TLoadButton) => {
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
