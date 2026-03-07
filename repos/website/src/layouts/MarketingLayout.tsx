import { Outlet } from 'react-router'
import Box from '@mui/material/Box'
import Header from '@TAF/components/Header/Header'
import MarketingFooter from '@TAF/components/Footer/MarketingFooter'

const MarketingLayout = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
    <Header />
    <Box
      component='main'
      sx={{ flex: 1 }}
    >
      <Outlet />
    </Box>
    <MarketingFooter />
  </Box>
)

export default MarketingLayout
