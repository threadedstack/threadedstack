import type { TGitBrand } from '@tdsk/domain'

import { useMemo } from 'react'
import { EGitProvider } from '@tdsk/domain'
import { GitlabIcon } from '@tdsk/components'
import { Box, Typography } from '@mui/material'
import { LinkOff as GitIcon, GitHub as GitHubIcon } from '@mui/icons-material'

export type TGitInfo = {
  gitUrl: string
  branch: string
  brand?: TGitBrand
}

const useGitIcon = (props: TGitInfo) => {
  return useMemo(() => {
    if (props.brand === EGitProvider.github || props.gitUrl.includes(`github.com`))
      return GitHubIcon

    if (props.brand === EGitProvider.gitlab || props.gitUrl.includes(`gitlab.com`))
      return GitlabIcon

    return GitIcon
  }, [props.brand, props.gitUrl])
}

export const GitInfo = (props: TGitInfo) => {
  const Icon = useGitIcon(props)

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
