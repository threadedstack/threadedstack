import { useState, useCallback } from 'react'
import type { FormEvent } from 'react'

import Link from '@mui/material/Link'
import Alert from '@mui/material/Alert'
import { TextInput } from '@tdsk/components'
import Typography from '@mui/material/Typography'

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
  const { error, success, loading, onSignIn, onSignUp, onForgotPassword } = props

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

  const onToggleMode = useCallback(() => setIsSignUp((prev) => !prev), [])

  return (
    <EmailFormContainer onSubmit={onSubmit}>
      {error && <Alert severity='error'>{error}</Alert>}
      {success && <Alert severity='success'>{success}</Alert>}

      <TextInput
        required
        fullWidth
        type='email'
        size='small'
        label='Email'
        value={email}
        id='login-email'
        disabled={loading}
        autoComplete='email'
        onChange={(e) => setEmail(e.target.value)}
      />

      <TextInput
        required
        fullWidth
        size='small'
        type='password'
        value={password}
        label='Password'
        disabled={loading}
        id='login-password'
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={isSignUp ? `new-password` : `current-password`}
      />

      <EmailFormButton
        fullWidth
        type='submit'
        loading={loading}
        disabled={loading}
        variant='contained'
        aria-label={isSignUp ? `Sign Up` : `Sign In`}
      >
        {isSignUp ? `Sign Up` : `Sign In`}
      </EmailFormButton>

      <Typography
        align='center'
        variant='body2'
      >
        {isSignUp ? (
          <>
            Already have an account?{` `}
            <Link
              type='button'
              variant='body2'
              component='button'
              onClick={onToggleMode}
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            <Link
              type='button'
              variant='body2'
              component='button'
              onClick={onToggleMode}
            >
              Create account
            </Link>
            {onForgotPassword && (
              <>
                {` · `}
                <Link
                  type='button'
                  variant='body2'
                  component='button'
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
