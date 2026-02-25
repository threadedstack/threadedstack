import type { TNavCtx, TRailSection } from '@TAF/types'

import { useNavigate } from 'react-router'
import { Add as AddIcon } from '@mui/icons-material'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { Box, Typography, Divider, IconButton } from '@mui/material'
import { SBNavList } from '@TAF/components/Sidebar/SBNavList'
import { SubNavPanelBox, SBSectionHeader } from '@TAF/components/Sidebar/Sidebar.styles'

export type TSubNavPanel = {
  section: TRailSection | null
  context: TNavCtx
  onCreateProject?: () => void
}

export const SubNavPanel = (props: TSubNavPanel) => {
  const { section, context, onCreateProject } = props
  const navigate = useNavigate()

  const resolvedHeader = section
    ? isFunc(section.header)
      ? section.header(context)
      : section.header
    : ``

  const resolvedTo = section
    ? isFunc(section.to)
      ? section.to(context)
      : section.to
    : undefined

  return (
    <SubNavPanelBox
      open={!!section}
      className='tdsk-subnav-panel'
    >
      {section && (
        <>
          <Box
            sx={{
              px: 2,
              py: 1.5,
              display: `flex`,
              alignItems: `center`,
              justifyContent: `space-between`,
              minHeight: 48,
            }}
          >
            <Typography
              noWrap
              variant='subtitle1'
              onClick={resolvedTo ? () => navigate(resolvedTo) : undefined}
              sx={{
                fontWeight: 600,
                fontSize: 14,
                cursor: resolvedTo ? `pointer` : `default`,
                '&:hover': resolvedTo ? { color: `primary.main` } : {},
              }}
            >
              {resolvedHeader}
            </Typography>
            {onCreateProject && section?.id === `org` && (
              <IconButton
                size='small'
                onClick={onCreateProject}
                sx={{ ml: 1 }}
              >
                <AddIcon fontSize='small' />
              </IconButton>
            )}
          </Box>
          <Divider />

          {section.groups.map((group) => (
            <Box key={group.label}>
              <SBSectionHeader>
                <Typography>{group.label}</Typography>
              </SBSectionHeader>
              <SBNavList
                open={true}
                context={context}
                items={group.items}
              />
            </Box>
          ))}
        </>
      )}
    </SubNavPanelBox>
  )
}
