import Box from '@mui/material/Box'
import Header from '@TAF/components/Header/Header'
import { Outlet, useLocation } from 'react-router'
import { usePostHogPageView } from '@tdsk/components'
import DocsFooter from '@TAF/components/Footer/DocsFooter'
import DocsSidebar from '@TAF/components/Docs/DocsSidebar'
import DocsTableOfContents from '@TAF/components/Docs/DocsTableOfContents'

const DocsLayout = () => {
  const location = useLocation()
  usePostHogPageView(location.pathname, location.search)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <Box sx={{ display: 'flex', flex: 1 }}>
        <DocsSidebar />
        <Box
          component='main'
          sx={{ flex: 1, maxWidth: 800, mx: 'auto', px: 3, py: 4, minWidth: 0 }}
        >
          <Outlet />
        </Box>
        <DocsTableOfContents />
      </Box>
      <DocsFooter />
    </Box>
  )
}

export default DocsLayout
