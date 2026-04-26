import type { TProviderBtnProps, TLoginData } from '../../types'

import { VercelIcon } from '../Icons/VercelIcon'
import { ProviderLoginButton } from './Login.styles'

const creds: TLoginData = {
  provider: `vercel`,
}

export const VrButton = (props: TProviderBtnProps) => {
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
