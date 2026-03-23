import Card from '@mui/material/Card'
import { Text } from '@tdsk/components'
import { Page } from '@TTH/pages/Page/Page'
import Container from '@mui/material/Container'
import CardContent from '@mui/material/CardContent'

export type THome = {}

export const Home = (props: THome) => {
  return (
    <Page className='tdsk-home-page'>
      <Container
        maxWidth='lg'
        disableGutters
      >
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
          </CardContent>
        </Card>
      </Container>
    </Page>
  )
}

export default Home
