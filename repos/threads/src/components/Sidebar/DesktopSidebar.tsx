import { colors, cmx } from '@tdsk/components'
import { goToOrgs } from '@TTH/actions/orgs/goToOrgs'
import { Box, Typography, Divider } from '@mui/material'
import { NavTree } from '@TTH/components/Sidebar/NavTree'
import { Business, ChevronRight } from '@mui/icons-material'
import { useOrgId, useActiveOrg } from '@TTH/state/selectors'
import { goToProjects } from '@TTH/actions/projects/goToProjects'
import { SidebarContainer } from '@TTH/components/Sidebar/Sidebar.styles'

export const DesktopSidebar = () => {
  const [orgId] = useOrgId()
  const [activeOrg] = useActiveOrg()

  return (
    <SidebarContainer className='tdsk-threads-sidebar'>
      <Box
        sx={{
          width: 240,
          height: `100%`,
          display: `flex`,
          overflow: `hidden`,
          flexDirection: `column`,
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
                letterSpacing: `0.5px`,
                color: `text.secondary`,
                textTransform: `uppercase`,
              }}
            >
              Organizations
            </Typography>
          </Box>

          {orgId && activeOrg && (
            <Box
              onClick={() => goToProjects(orgId)}
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
            px: 0.5,
            py: 0.5,
            flex: 1,
            overflow: `auto`,
          }}
        >
          {orgId && <NavTree />}
        </Box>
      </Box>
    </SidebarContainer>
  )
}
