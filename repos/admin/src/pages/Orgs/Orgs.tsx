import Box from '@mui/material/Box'
import { Text } from '@tdsk/components'
import { Page } from '@TAF/pages/Page/Page'
import { Orgs } from '@TAF/components/Orgs/Orgs'

export type TOrgs = {}

export const OrgsPage = (props: TOrgs) => {
  return (
    <Page className='tdsk-orgs-page'>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          variant='h5'
          component='h1'
        >
          Organizations
        </Text>
        <Text color='text.secondary'>
          Choose an organization to continue or create a new one
        </Text>
      </Box>

      <Orgs />
    </Page>
  )
}

export default OrgsPage
