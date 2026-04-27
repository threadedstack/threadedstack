import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import { Text } from '@tdsk/components'
import Button from '@mui/material/Button'
import { Page } from '@TAF/pages/Page/Page'
import { useState, useEffect } from 'react'
import { useOrgs } from '@TAF/state/selectors'
import Container from '@mui/material/Container'
import { Orgs } from '@TAF/components/Orgs/Orgs'
import CardContent from '@mui/material/CardContent'
import { useOnboardingState } from '@TAF/state/selectors'
import { OnboardingWizard } from '@TAF/components/Onboarding'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import { CreateOrgDrawer } from '@TAF/components/Orgs/CreateOrgDrawer'
import { openOnboarding } from '@TAF/actions/onboarding/local/openOnboarding'

export type THome = {}

export const Home = (props: THome) => {
  const [orgs] = useOrgs()
  const [onboarding] = useOnboardingState()
  const orgsArray = orgs ? Object.values(orgs) : []
  const hasOrgs = orgsArray.length > 0
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (!hasOrgs && !onboarding.open) {
      openOnboarding({ mode: `auto` })
    }
  }, [hasOrgs, onboarding.open])

  const openManualWizard = () => {
    openOnboarding({ mode: `manual` })
  }

  return (
    <Page className='tdsk-home-page'>
      <Container
        maxWidth='lg'
        disableGutters
      >
        {!hasOrgs ? (
          <Card
            variant='outlined'
            sx={{ mb: 3, backgroundColor: `action.hover` }}
          >
            <CardContent sx={{ textAlign: `center`, py: 4 }}>
              <Text
                variant='h5'
                gutterBottom
              >
                Welcome to Threaded Stack
              </Text>
              <Text
                variant='body1'
                sx={{ mb: 2 }}
                color='text.secondary'
              >
                Create your first organization to get started
              </Text>
            </CardContent>
          </Card>
        ) : (
          <>
            <Box
              sx={{
                mb: 1,
                display: `flex`,
                alignItems: `center`,
                justifyContent: `space-between`,
              }}
            >
              <Box>
                <Text
                  variant='h5'
                  component='h1'
                  gutterBottom
                >
                  Organizations
                </Text>
                <Text color='text.secondary'>
                  Choose an organization to continue or create a new one
                </Text>
              </Box>
              <Button
                variant='outlined'
                onClick={openManualWizard}
                startIcon={<RocketLaunchIcon />}
              >
                Setup Wizard
              </Button>
            </Box>
            <Orgs />
          </>
        )}

        <CreateOrgDrawer
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      </Container>

      <OnboardingWizard />
    </Page>
  )
}

export default Home
