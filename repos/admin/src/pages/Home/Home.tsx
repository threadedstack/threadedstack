import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import { Text } from '@tdsk/components'
import { Page } from '@TAF/pages/Page/Page'
import Container from '@mui/material/Container'
import { Orgs } from '@TAF/components/Orgs/Orgs'
import CardContent from '@mui/material/CardContent'
import { useOrgs } from '@TAF/state/selectors'
import { Quickstart } from '@TAF/components/Quickstart/Quickstart'

export type THome = {}

export const Home = (props: THome) => {
  const [orgs] = useOrgs()
  const orgsArray = orgs ? Object.values(orgs) : []
  const hasOrgs = orgsArray.length > 0

  return (
    <Page className='tdsk-home-page'>
      <Container
        maxWidth='lg'
        disableGutters
      >
        {!hasOrgs && (
          <Card
            variant='outlined'
            sx={{ mb: 3, backgroundColor: `action.hover` }}
          >
            <CardContent sx={{ textAlign: `center`, py: 4 }}>
              <Text
                variant='h5'
                gutterBottom
              >
                Get Started with AI Agents
              </Text>
              <Text
                variant='body1'
                color='text.secondary'
                sx={{ mb: 2 }}
              >
                Create your first AI agent in under a minute
              </Text>
              <Quickstart />
            </CardContent>
          </Card>
        )}

        <Box
          sx={{
            display: `flex`,
            alignItems: `center`,
            justifyContent: `space-between`,
            mb: 1,
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
          {/* TODO: This is in the wrong place, so be added on the Org page */}
          {/* It's not easily accessible on the Orgs list page */}
          {hasOrgs && <Quickstart />}
        </Box>

        <Orgs />
      </Container>
    </Page>
  )
}

export default Home
