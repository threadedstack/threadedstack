import { WaitlistCard, WaitlistMessage } from '@TSC/components/Waitlist/Waitlist.styles'
import {
  BrandLogo,
  BrandGlow,
  BrandBlob1,
  BrandBlob2,
  LoginContent,
  BrandSubtitle,
  BrandHeadline,
  LoginContainer,
  EmailFormButton,
  LoginMainContainer,
} from '@TSC/components/Login/Login.styles'

export type TWaitlistPage = {
  onSignOut: () => void
}

export const Waitlist = (props: TWaitlistPage) => {
  const { onSignOut } = props

  return (
    <LoginContainer className='tdsk-waitlist-container'>
      <BrandGlow />
      <BrandBlob1 />
      <BrandBlob2 />

      <LoginContent className='tdsk-waitlist-content'>
        <BrandLogo />
        <BrandHeadline>{`You're on the Waitlist`}</BrandHeadline>
        <BrandSubtitle>{`Thanks for signing up for Threaded Stack`}</BrandSubtitle>

        <LoginMainContainer>
          <WaitlistCard className='tdsk-waitlist-card'>
            <WaitlistMessage className='tdsk-waitlist-message'>
              Your account is pending approval. We'll notify you by email once your access
              has been activated.
            </WaitlistMessage>
          </WaitlistCard>

          <EmailFormButton
            fullWidth
            type='submit'
            variant='contained'
            onClick={onSignOut}
            aria-label='Sign Out'
            className='tdsk-waitlist-signout'
          >
            Sign Out
          </EmailFormButton>
        </LoginMainContainer>
      </LoginContent>
    </LoginContainer>
  )
}
