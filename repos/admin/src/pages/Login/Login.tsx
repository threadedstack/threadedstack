import type { TOnLogin } from '@TAF/types'

import { useState } from 'react'
import { useParams } from 'react-router'
import { Login } from '@TAF/components/Login'
import { TDSK_AUTH_PROVIDERS } from '@TAF/constants/envs'
import { signin } from '@TAF/actions/auth/local/signin'

export type TLogin = {}

export const LoginPage = (props:TLogin) => {

  const [error, setError] = useState<string>()
  const [authenticating, setAuthenticating] = useState<string>()

  const onLogin:TOnLogin = async (data) => {
    setAuthenticating(data.provider)
    const resp = await signin(data.provider)
    resp.error && setError(resp.error.message)
    setAuthenticating(undefined)
  }

  return (
    <Login
      error={error}
      onLogin={onLogin}
      providers={TDSK_AUTH_PROVIDERS}
      authenticating={authenticating}
    />
  )

}

export default LoginPage
