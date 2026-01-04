import type { TOnLogin, TLoginData } from '@TAF/types'

import { GitlabIcon } from '@tdsk/components'
import { GlLoginButton } from '@TAF/components/Login/Login.styles'

export type TGithubButton = {
  loading?:boolean
  disabled?:boolean
  onLogin:TOnLogin
}

const creds:TLoginData = {
  provider: `gitlab`
}

export const GlButton = (props:TGithubButton) => {
  const {
    onLogin,
    loading,
    disabled,
  } = props

  return (
    <GlLoginButton
      text={`Gitlab`}
      Icon={GitlabIcon}
      loading={loading}
      disabled={disabled}
      variant={`contained`}
      onClick={() => onLogin(creds)}
    />
  )
}
