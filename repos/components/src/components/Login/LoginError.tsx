import type { TLoginError } from '../../types'

import { ErrorText, ErrorTitle, ErrorSection, LoginContainer } from './Login.styles'

export const LoginError = (props: TLoginError) => {
  const { message } = props

  return (
    <LoginContainer>
      <ErrorSection className='tdsk-login-error-section'>
        <ErrorTitle>Authentication Error</ErrorTitle>
        <ErrorText className='tdsk-login-error-text'>{message}</ErrorText>
      </ErrorSection>
    </LoginContainer>
  )
}
