import type { ReactNode } from 'react'
import type { TOnLogin } from '@TAF/types'
import Divider from '@mui/material/Divider'
import { GhButton } from '@TAF/components/Login/GithubBtn'
import { GgButton } from '@TAF/components/Login/GoogleBtn'
import { VrButton } from '@TAF/components/Login/VercelBtn'
import { EmailLoginForm } from '@TAF/components/Login/EmailLoginForm'

import {
  TSLogo,
  ErrorText,
  BtnSection,
  LoginStack,
  ErrorTitle,
  LoginHeader,
  LoginContent,
  ErrorSection,
  LoginMainText,
  LoginMainIcon,
  LoginContainer,
  LoginHeaderText,
  LoginMainHeader,
  LoginMainContainer,
} from '@TAF/components/Login/Login.styles'

type TLoginBtn = (props: TLoginBtnProps) => ReactNode

export type TLoginBtnProps = {
  error?: string
  onLogin: TOnLogin
  loading?: boolean
  disabled?: boolean
  authenticating?: string
}

export type TLogin = TLoginBtnProps & {
  providers: Array<string>
  showEmailForm?: boolean
  emailError?: string
  emailSuccess?: string
  emailLoading?: boolean
  onEmailSignIn?: (email: string, password: string) => Promise<void>
  onEmailSignUp?: (email: string, password: string) => Promise<void>
  onForgotPassword?: (email: string) => Promise<void>
}

const LoginBtns: Record<string, TLoginBtn> = {
  github: GhButton,
  google: GgButton,
  vercel: VrButton,
}

export const Login = (props: TLogin) => {
  const {
    error,
    onLogin,
    providers,
    authenticating,
    showEmailForm,
    emailError,
    emailSuccess,
    emailLoading,
    onEmailSignIn,
    onEmailSignUp,
    onForgotPassword,
  } = props

  const hasSocialProviders = providers.some((p) => LoginBtns[p])

  return (
    <LoginContainer className='tdsk-login-container'>
      <LoginContent className='tdsk-login-content'>
        <LoginHeader className='tdsk-login-header'>
          <TSLogo />
          <LoginHeaderText>Threaded Stack</LoginHeaderText>
        </LoginHeader>
        <LoginMainContainer>
          <LoginMainHeader className='tdsk-login-main-header'>
            <LoginMainIcon />
            <LoginMainText>Sign In</LoginMainText>
          </LoginMainHeader>
          <LoginStack className='tdsk-login-stack'>
            {providers.map((provider) => {
              const Button = LoginBtns[provider]
              const loading = authenticating === provider

              return (
                (Button && (
                  <BtnSection key={provider}>
                    <Button
                      onLogin={onLogin}
                      loading={loading}
                      disabled={Boolean(authenticating) || emailLoading}
                    />
                  </BtnSection>
                )) ||
                null
              )
            })}
          </LoginStack>

          {showEmailForm && onEmailSignIn && onEmailSignUp && (
            <BtnSection
              className='tdsk-login-email'
              sx={{ flexDirection: `column` }}
            >
              {hasSocialProviders && <Divider sx={{ my: 1, width: `100%` }}>or</Divider>}
              <EmailLoginForm
                onSignIn={onEmailSignIn}
                onSignUp={onEmailSignUp}
                onForgotPassword={onForgotPassword}
                error={emailError}
                success={emailSuccess}
                loading={emailLoading || Boolean(authenticating)}
              />
            </BtnSection>
          )}

          {(error && (
            <ErrorSection className='tdsk-login-error-section'>
              <ErrorTitle>Authentication Error</ErrorTitle>
              <ErrorText className='tdsk-login-error-text'>{error}</ErrorText>
            </ErrorSection>
          )) ||
            null}
        </LoginMainContainer>
      </LoginContent>
    </LoginContainer>
  )
}
