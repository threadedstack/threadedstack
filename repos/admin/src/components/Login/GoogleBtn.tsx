import type { TOnLogin, TLoginData } from '@TAF/types'

import GoogleIcon from '@mui/icons-material/Google'
import { GgLoginButton } from '@TAF/components/Login/Login.styles'

export type TGoogleButton = {
  loading?: boolean
  disabled?: boolean
  onLogin: TOnLogin
}

const creds: TLoginData = {
  /** A URL to send the user to after they are confirmed. */
  //  redirectTo?: string

  /** A space-separated list of scopes granted to the OAuth application. */
  //  scopes?: string

  /** One of the providers supported by GoTrue. */
  provider: `google`,
  options: {
    /** If set to true does not immediately redirect the current browser context to visit the OAuth authorization page for the provider. */
    //skipBrowserRedirect?: boolean
    /** An object of query params */
    //queryParams: {},
  },
}

export const GgButton = (props: TGoogleButton) => {
  const { onLogin, loading, disabled } = props

  return (
    <GgLoginButton
      text={`Google`}
      Icon={GoogleIcon}
      loading={loading}
      disabled={disabled}
      variant={`contained`}
      onClick={() => onLogin(creds)}
    />
  )
}
