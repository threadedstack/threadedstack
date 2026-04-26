import type { TProviderBtnProps, TLoginData } from '../../types'

import { GitlabIcon } from '../Icons/GitlabIcon'
import { ProviderLoginButton } from './Login.styles'

const creds: TLoginData = {
  provider: `gitlab`,
}

export const GlButton = (props: TProviderBtnProps) => {
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
