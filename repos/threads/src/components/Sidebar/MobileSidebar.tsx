import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { colors, cmx } from '@tdsk/components'
import { SidebarWidthOpen } from '@TTH/constants/values'
import { NavTree } from '@TTH/components/Sidebar/NavTree'
import { Business, ChevronRight } from '@mui/icons-material'
import { Divider, Box, SwipeableDrawer, Typography } from '@mui/material'
import { useOrgId, useActiveOrg, useSidebarOpen } from '@TTH/state/selectors'
import { openSidebar, closeSidebar } from '@TTH/actions/sidebar/toggleSidebar'

export const MobileSidebar = () => {
  const [open] = useSidebarOpen()
  const [orgId] = useOrgId()
  const [activeOrg] = useActiveOrg()
  const navigate = useNavigate()

  const goToOrgs = useCallback(() => {
    closeSidebar()
    navigate(`/orgs`)
  }, [navigate])

  const goToProjects = useCallback(() => {
    if (orgId) {
      closeSidebar()
      navigate(`/orgs/${orgId}/projects`)
    }
  }, [navigate, orgId])

  return (
    <SwipeableDrawer
      open={open}
      variant='temporary'
      onOpen={openSidebar}
      onClose={closeSidebar}
      className='tdsk-threads-sidebar'
      ModalProps={{ keepMounted: true }}
      sx={{
        [`& .MuiDrawer-paper`]: {
          width: SidebarWidthOpen,
          boxSizing: `border-box`,
        },
      }}
    >
      <Box sx={{ px: 1, py: 1, display: `flex`, flexDirection: `column`, gap: 0.25 }}>
        <Box
          onClick={goToOrgs}
          sx={{
            px: 1,
            py: 0.75,
            gap: 0.75,
            display: `flex`,
            borderRadius: 1,
            cursor: `pointer`,
            userSelect: `none`,
            alignItems: `center`,
            '&:hover': {
              backgroundColor: cmx(colors.grey[500], 5),
            },
          }}
        >
          <Business sx={{ fontSize: 16, color: colors.grey[500] }} />
          <Typography
            variant='caption'
            sx={{
              flex: 1,
              fontWeight: 600,
              textTransform: `uppercase`,
              letterSpacing: `0.5px`,
              color: `text.secondary`,
            }}
          >
            Organizations
          </Typography>
        </Box>

        {orgId && activeOrg && (
          <Box
            onClick={goToProjects}
            sx={{
              px: 1,
              py: 0.75,
              gap: 0.75,
              borderRadius: 1,
              display: `flex`,
              cursor: `pointer`,
              alignItems: `center`,
              userSelect: `none`,
              '&:hover': {
                backgroundColor: cmx(colors.grey[500], 5),
              },
            }}
          >
            <ChevronRight sx={{ fontSize: 16, color: colors.grey[500] }} />
            <Typography
              noWrap
              variant='body2'
              sx={{
                flex: 1,
                fontWeight: 500,
                color: `text.primary`,
              }}
            >
              {activeOrg.name}
            </Typography>
          </Box>
        )}
      </Box>

      {orgId && <Divider />}

      <Box
        sx={{
          flex: 1,
          px: 0.5,
          py: 0.5,
          overflow: `auto`,
        }}
      >
        {orgId && <NavTree />}
      </Box>
    </SwipeableDrawer>
  )
}
