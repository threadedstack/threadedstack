import type { TLogin, TLoginBtns } from '@TSC/types'

import Divider from '@mui/material/Divider'
import { GhButton } from '@TSC/components/Login/GithubBtn'
import { GgButton } from '@TSC/components/Login/GoogleBtn'
import { GlButton } from '@TSC/components/Login/GitlabBtn'
import { VrButton } from '@TSC/components/Login/VercelBtn'
import { EmailLoginForm } from '@TSC/components/Login/EmailLoginForm'

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
} from './Login.styles'

const DefaultHeadline = `Threaded Stack`
const DefaultSubtitle = `Secure AI agent orchestration with enterprise-grade security`

const LoginBtns: TLoginBtns = {
  github: GhButton,
  google: GgButton,
  gitlab: GlButton,
  vercel: VrButton,
}

export const Login = (props: TLogin) => {
  const {
    error,
    onLogin,
    providers,
    emailError,
    emailSuccess,
    emailLoading,
    onEmailSignIn,
    onEmailSignUp,
    showEmailForm,
    authenticating,
    onForgotPassword,
    headline = DefaultHeadline,
    subtitle = DefaultSubtitle,
  } = props

  const hasSocialProviders = providers.some((p) => LoginBtns[p])

  return (
    <LoginContainer className='tdsk-login-container'>
      <BrandGlow />
      <BrandBlob1 />
      <BrandBlob2 />

      <LoginContent className='tdsk-login-content'>
        <BrandLogo />
        <BrandHeadline>{headline}</BrandHeadline>
        <BrandSubtitle>{subtitle}</BrandSubtitle>

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
                error={emailError}
                success={emailSuccess}
                onSignIn={onEmailSignIn}
                onSignUp={onEmailSignUp}
                onForgotPassword={onForgotPassword}
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
