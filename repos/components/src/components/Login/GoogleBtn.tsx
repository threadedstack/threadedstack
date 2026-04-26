import type { TProviderBtnProps, TLoginData } from '../../types'

import GoogleIcon from '@mui/icons-material/Google'
import { ProviderLoginButton } from './Login.styles'

const creds: TLoginData = {
  provider: `google`,
}

export const GgButton = (props: TProviderBtnProps) => {
  const { onLogin, loading, disabled } = props

  return (
    <ProviderLoginButton
      text={`Google`}
      Icon={GoogleIcon}
      loading={loading}
      disabled={disabled}
      variant={`contained`}
      onClick={() => onLogin(creds)}
    />
  )
}
