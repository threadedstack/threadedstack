import { useState, useCallback } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import Alert from '@mui/material/Alert'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'

import { EmailFormContainer, EmailFormButton } from './Login.styles'

export type TEmailLoginFormProps = {
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
  onForgotPassword?: (email: string) => Promise<void>
  error?: string
  success?: string
  loading?: boolean
}

export const EmailLoginForm = (props: TEmailLoginFormProps) => {
  const { onSignIn, onSignUp, onForgotPassword, error, success, loading } = props

  const [email, setEmail] = useState(``)
  const [password, setPassword] = useState(``)
  const [isSignUp, setIsSignUp] = useState(false)

  const onSubmit = useCallback(
    (evt: FormEvent) => {
      evt.preventDefault()
      if (isSignUp) onSignUp(email, password)
      else onSignIn(email, password)
    },
    [email, password, isSignUp, onSignIn, onSignUp]
  )

  const onToggleMode = useCallback(() => {
    setIsSignUp((prev) => !prev)
  }, [])

  const onEmailChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
  }, [])

  const onPasswordChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
  }, [])

  return (
    <EmailFormContainer onSubmit={onSubmit}>
      {error && <Alert severity='error'>{error}</Alert>}
      {success && <Alert severity='success'>{success}</Alert>}

      <TextField
        required
        fullWidth
        type='email'
        label='Email'
        value={email}
        onChange={onEmailChange}
        disabled={loading}
        autoComplete='email'
        size='small'
      />

      <TextField
        required
        fullWidth
        type='password'
        label='Password'
        value={password}
        onChange={onPasswordChange}
        disabled={loading}
        autoComplete={isSignUp ? `new-password` : `current-password`}
        size='small'
      />

      <EmailFormButton
        type='submit'
        variant='contained'
        fullWidth
        loading={loading}
        disabled={loading}
        aria-label={isSignUp ? `Sign Up` : `Sign In`}
      >
        {isSignUp ? `Sign Up` : `Sign In`}
      </EmailFormButton>

      <Typography
        variant='body2'
        align='center'
      >
        {isSignUp ? (
          <>
            Already have an account?{` `}
            <Link
              component='button'
              type='button'
              variant='body2'
              onClick={onToggleMode}
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            <Link
              component='button'
              type='button'
              variant='body2'
              onClick={onToggleMode}
            >
              Create account
            </Link>
            {onForgotPassword && (
              <>
                {` · `}
                <Link
                  component='button'
                  type='button'
                  variant='body2'
                  onClick={() => onForgotPassword(email)}
                >
                  Forgot password?
                </Link>
              </>
            )}
          </>
        )}
      </Typography>
    </EmailFormContainer>
  )
}
