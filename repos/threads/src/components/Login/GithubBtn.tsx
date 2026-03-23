import type { TOnLogin, TLoginData } from '@TTH/types'

import GitHubIcon from '@mui/icons-material/GitHub'
import { ProviderLoginButton } from '@TTH/components/Login/Login.styles'

export type TGithubButton = {
  loading?: boolean
  disabled?: boolean
  onLogin: TOnLogin
}

const creds: TLoginData = {
  provider: `github`,
}

export const GhButton = (props: TGithubButton) => {
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
