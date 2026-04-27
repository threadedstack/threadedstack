import { Box, Typography } from '@mui/material'

import { LinkOff as GitIcon, GitHub as GitHubIcon } from '@mui/icons-material'

export type TGitInfo = {
  gitUrl: string
  branch: string
}

export const GitInfo = (props: TGitInfo) => {
  const isGitHub = props.gitUrl.includes(`github.com`)
  const Icon = isGitHub ? GitHubIcon : GitIcon

  return (
    <Box
      sx={{
        mt: 0.5,
        gap: 0.75,
        display: `flex`,
        alignItems: `center`,
      }}
    >
      <Icon sx={{ fontSize: 14, color: `text.disabled` }} />
      <Typography
        noWrap
        variant='caption'
        color='text.disabled'
        sx={{ maxWidth: 400 }}
      >
        {props.gitUrl}
      </Typography>
      <Typography
        variant='caption'
        color='text.disabled'
      >
        {`\u00B7`}
      </Typography>
      <Typography
        variant='caption'
        color='text.disabled'
      >
        {props.branch}
      </Typography>
    </Box>
  )
}
