import Box from '@mui/material/Box'
import { Outlet, useLocation } from 'react-router'
import Header from '@TAF/components/Header/Header'
import { usePostHogPageView } from '@tdsk/components'
import MarketingFooter from '@TAF/components/Footer/MarketingFooter'

const MarketingLayout = () => {
  const location = useLocation()
  usePostHogPageView(location.pathname, location.search)

  return (
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
}

export default MarketingLayout
