import { Page } from '@TAF/pages/Page/Page'
import { Box, Typography } from '@mui/material'
import { Orgs } from '@TAF/components/Orgs/Orgs'

export type TOrgs = {}

export const OrgsPage = (props: TOrgs) => {
  return (
    <Page className='tdsk-orgs-page'>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography
          variant='h4'
          component='h1'
        >
          Organizations
        </Typography>
      </Box>

      <Orgs />
    </Page>
  )
}

export default OrgsPage
