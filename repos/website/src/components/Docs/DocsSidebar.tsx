import { useState } from 'react'
import { useLocation, Link as RouterLink } from 'react-router'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Collapse from '@mui/material/Collapse'
import Typography from '@mui/material/Typography'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import { sections } from '@TAF/utils/docsContent'

const DocsSidebar = () => {
  const { pathname } = useLocation()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const section of sections) {
      initial[section.label] = section.items.some((item) =>
        pathname.startsWith(item.path)
      )
    }
    return initial
  })

  const toggle = (label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <Box
      sx={{
        width: 240,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        display: { xs: 'none', md: 'block' },
        overflow: 'auto',
        py: 2,
        position: 'sticky',
        top: 64,
        height: 'calc(100vh - 64px)',
      }}
    >
      <List disablePadding>
        {sections.map((section) => (
          <Box key={section.label}>
            <ListItemButton
              onClick={() => toggle(section.label)}
              sx={{ py: 0.5, px: 2 }}
            >
              <Typography
                variant='overline'
                sx={{ fontSize: 11, letterSpacing: 1.5, flex: 1 }}
              >
                {section.label}
              </Typography>
              {openSections[section.label] ? (
                <ExpandLess sx={{ fontSize: 18 }} />
              ) : (
                <ExpandMore sx={{ fontSize: 18 }} />
              )}
            </ListItemButton>
            <Collapse in={openSections[section.label]}>
              <List disablePadding>
                {section.items.map((item) => {
                  const active = pathname === item.path
                  return (
                    <ListItemButton
                      key={item.path}
                      component={RouterLink}
                      to={item.path}
                      sx={{
                        py: 0.5,
                        pl: 3,
                        pr: 2,
                        borderLeft: active ? 3 : 3,
                        borderColor: active ? 'primary.main' : 'transparent',
                        bgcolor: active ? 'action.selected' : 'transparent',
                      }}
                    >
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          variant: 'body2',
                          fontSize: 13,
                          color: active ? 'primary.main' : 'text.secondary',
                          fontWeight: active ? 600 : 400,
                        }}
                      />
                    </ListItemButton>
                  )
                })}
              </List>
            </Collapse>
          </Box>
        ))}
      </List>
    </Box>
  )
}

export default DocsSidebar
