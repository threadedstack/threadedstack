import type { TOnLogin, TLoginData } from '@TAF/types'

import { VercelIcon } from '@tdsk/components'
import { ProviderLoginButton } from '@TAF/components/Login/Login.styles'

export type TVercelButton = {
  loading?: boolean
  disabled?: boolean
  onLogin: TOnLogin
}

const creds: TLoginData = {
  provider: `vercel`,
}

export const VrButton = (props: TVercelButton) => {
  const { onLogin, loading, disabled } = props

  return (
    <ProviderLoginButton
      text={`Vercel`}
      Icon={VercelIcon}
      loading={loading}
      disabled={disabled}
      variant={`contained`}
      onClick={() => onLogin(creds)}
    />
  )
}
