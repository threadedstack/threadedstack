import type { TOnLogin, TLoginData } from '@TAF/types'

import GitHubIcon from '@mui/icons-material/GitHub'
import { GhLoginButton } from '@TAF/components/Login/Login.styles'

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
    <GhLoginButton
      text={`Github`}
      Icon={GitHubIcon}
      loading={loading}
      disabled={disabled}
      variant={`contained`}
      onClick={() => onLogin(creds)}
    />
  )
}
