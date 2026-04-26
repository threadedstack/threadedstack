import type { TProviderBtnProps, TLoginData } from '../../types'

import GitHubIcon from '@mui/icons-material/GitHub'
import { ProviderLoginButton } from './Login.styles'

const creds: TLoginData = {
  provider: `github`,
}

export const GhButton = (props: TProviderBtnProps) => {
  const { onLogin, loading, disabled } = props

  return (
    <ProviderLoginButton
      text={`Github`}
      Icon={GitHubIcon}
      loading={loading}
      disabled={disabled}
      variant={`contained`}
      onClick={() => onLogin(creds)}
    />
  )
}
