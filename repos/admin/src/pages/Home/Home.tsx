import Box from '@mui/material/Box'
import { Text } from '@tdsk/components'
import { Page } from '@TAF/pages/Page/Page'
import Container from '@mui/material/Container'
import { Orgs } from '@TAF/components/Orgs/Orgs'

export type THome = {}

export const Home = (props: THome) => {
  return (
    <Page className='tdsk-home-page'>
      <Container
        maxWidth='lg'
        disableGutters
      >
        <Box sx={{ mb: 1 }}>
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

        <Orgs />
      </Container>
    </Page>
  )
}

export default Home
