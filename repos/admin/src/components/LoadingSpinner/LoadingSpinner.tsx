import type { CSSProperties } from 'react'
import { Loading } from '@tdsk/components'

export type TLoadingSpinner = {
  size?: number
  sx?: CSSProperties
}

/**
 * LoadingSpinner - Wrapper around @tdsk/components Loading
 * Provides a simple centered loading spinner
 */
export const LoadingSpinner = ({ size = 40, sx }: TLoadingSpinner) => {
  return (
    <Loading
      full
      size={size}
      containerSx={{ my: 4, ...sx }}
    />
  )
}

export default LoadingSpinner
