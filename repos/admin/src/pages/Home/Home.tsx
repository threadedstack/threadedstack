import { Page } from '@TAF/pages/Page/Page'
import { Box, Typography } from '@mui/material'
import { Orgs } from '@TAF/components/Orgs/Orgs'

export type THome = {}

export const Home = (props: THome) => {
  return (
    <Page className='tdsk-home-page'>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant='h4'
          component='h1'
          gutterBottom
        >
          Your Organizations
        </Typography>
        <Typography color='text.secondary'>
          Choose an organization to continue or create a new one
        </Typography>
      </Box>

      <Orgs />
    </Page>
  )
}

export default Home
