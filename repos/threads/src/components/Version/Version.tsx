import type { CSSProperties } from 'react'
import { TDSK_TH_APP_VERSION } from '@TTH/constants'

const styles: Record<string, CSSProperties> = {
  container: {
    zIndex: 10,
    right: `5px`,
    bottom: `5px`,
    position: `absolute`,
    backgroundColor: `transparent`,
  },
  text: {
    opacity: 0.5,
    fontSize: `12px`,
    backgroundColor: `transparent`,
  },
}

export const Version = () => {
  return (
    <div
      style={styles.container}
      className='tdsk-app-version-container'
    >
      <span
        style={styles.text}
        className='tdsk-app-version-text'
      >
        v{TDSK_TH_APP_VERSION}
      </span>
    </div>
  )
}
