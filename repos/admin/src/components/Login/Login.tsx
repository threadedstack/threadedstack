import type { ReactNode } from 'react'
import type { TOnLogin } from '@TAF/types'
import Divider from '@mui/material/Divider'
import { GhButton } from '@TAF/components/Login/GithubBtn'
import { GgButton } from '@TAF/components/Login/GoogleBtn'
import { VrButton } from '@TAF/components/Login/VercelBtn'
import { EmailLoginForm } from '@TAF/components/Login/EmailLoginForm'

import {
  ErrorText,
  BtnSection,
  BrandBlob,
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
      <BrandGlow />
      <BrandBlob
        sx={{
          width: 400,
          height: 400,
          top: '10%',
          left: '5%',
          background:
            'radial-gradient(circle, rgba(51,112,222,0.07) 0%, transparent 65%)',
        }}
      />
      <BrandBlob
        sx={{
          width: 300,
          height: 300,
          bottom: '15%',
          right: '10%',
          animationDuration: '25s',
          animationDirection: 'reverse',
          background:
            'radial-gradient(circle, rgba(51,112,222,0.05) 0%, transparent 70%)',
        }}
      />

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
                    color: `rgba(255,255,255,0.4)`,
                    '&::before, &::after': { borderColor: `rgba(255,255,255,0.12)` },
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
