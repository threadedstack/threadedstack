import type { TOnLogin, TLoginData } from '@TTH/types'

import { GitlabIcon } from '@tdsk/components'
import { ProviderLoginButton } from '@TTH/components/Login/Login.styles'

export type TGitlabButton = {
  loading?: boolean
  disabled?: boolean
  onLogin: TOnLogin
}

const creds: TLoginData = {
  provider: `gitlab`,
}

export const GlButton = (props: TGitlabButton) => {
  const { onLogin, loading, disabled } = props

  return (
    <ProviderLoginButton
      text={`Gitlab`}
      Icon={GitlabIcon}
      loading={loading}
      disabled={disabled}
      variant={`contained`}
      onClick={() => onLogin(creds)}
    />
  )
}
