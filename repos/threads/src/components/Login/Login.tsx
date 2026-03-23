import type { ReactNode } from 'react'
import type { TOnLogin } from '@TTH/types'
import Divider from '@mui/material/Divider'
import { GhButton } from '@TTH/components/Login/GithubBtn'
import { GgButton } from '@TTH/components/Login/GoogleBtn'
import { VrButton } from '@TTH/components/Login/VercelBtn'
import { EmailLoginForm } from '@TTH/components/Login/EmailLoginForm'

import {
  ErrorText,
  BtnSection,
  BrandBlob1,
  BrandBlob2,
  BrandGlow,
  BrandLogo,
  LoginStack,
  ErrorTitle,
  BrandHeadline,
  BrandSubtitle,
  LoginContent,
  ErrorSection,
  LoginContainer,
  LoginMainContainer,
} from '@TTH/components/Login/Login.styles'

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
      <BrandGlow />
      <BrandBlob1 />
      <BrandBlob2 />

      <LoginContent className='tdsk-login-content'>
        <BrandLogo />
        <BrandHeadline>Threaded Stack</BrandHeadline>
        <BrandSubtitle>
          Secure AI agent orchestration with enterprise-grade security
        </BrandSubtitle>

        <LoginMainContainer>
          <LoginStack className='tdsk-login-stack'>
            {providers.map((provider) => {
              const Button = LoginBtns[provider]
              if (!Button) return null

              return (
                <BtnSection key={provider}>
                  <Button
                    onLogin={onLogin}
                    loading={authenticating === provider}
                    disabled={Boolean(authenticating) || emailLoading}
                  />
                </BtnSection>
              )
            })}
          </LoginStack>

          {showEmailForm && onEmailSignIn && onEmailSignUp && (
            <BtnSection
              className='tdsk-login-email'
              sx={{ flexDirection: `column` }}
            >
              {hasSocialProviders && (
                <Divider
                  sx={{
                    my: 1,
                    width: `100%`,
                    color: `text.secondary`,
                    '&::before, &::after': { borderColor: `divider` },
                  }}
                >
                  or
                </Divider>
              )}
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

          {error && (
            <ErrorSection className='tdsk-login-error-section'>
              <ErrorTitle>Authentication Error</ErrorTitle>
              <ErrorText className='tdsk-login-error-text'>{error}</ErrorText>
            </ErrorSection>
          )}
        </LoginMainContainer>
      </LoginContent>
    </LoginContainer>
  )
}
