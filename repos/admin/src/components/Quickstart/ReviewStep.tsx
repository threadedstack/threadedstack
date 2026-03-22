import type { TReviewStep } from '@TAF/types'
import type { ReactNode } from 'react'

import { useMemo } from 'react'
import ApiIcon from '@mui/icons-material/Api'
import { ProviderTemplates } from '@tdsk/domain'
import { useTheme, styled } from '@mui/material/styles'
import CloudQueueIcon from '@mui/icons-material/CloudQueue'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined'
import { Box, Card, Chip, CardContent, Typography } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { SectionHeader, SectionIcon } from '@TAF/components/Quickstart/Quickstart.styled'

type TReviewItem = {
  label: string
  type: string
  color: string
  icon: ReactNode
  details: string[]
}

const ResourceCard = styled(Card)(({ theme }) => ({
  borderRadius: theme.spacing(1.5),
  transition: `border-color 0.2s ease`,
  border: `1px solid ${theme.palette.divider}`,
  [`&:hover`]: {
    borderColor: theme.palette.primary.light,
  },
}))

const ResourceHeader = styled(Box)(({ theme }) => ({
  display: `flex`,
  alignItems: `center`,
  gap: theme.spacing(1.25),
  marginBottom: theme.spacing(0.75),
}))

export const ReviewStep = (props: TReviewStep) => {
  const { provider, agent } = props
  const theme = useTheme()
  const template = ProviderTemplates[provider.providerBrand]

  const items = useMemo<TReviewItem[]>(() => {
    const providerName =
      provider.providerBrand === `custom`
        ? provider.providerName || `Custom Provider`
        : template?.name || provider.providerBrand

    // provider.model is a raw ID (e.g., "claude-sonnet-4-20250514");
    // format it as a friendlier display name by capitalizing words
    const modelName = provider.model
      ? provider.model.replace(/[-_]/g, ` `).replace(/\b\w/g, (c) => c.toUpperCase())
      : provider.model

    const secretName = template?.defaultSecretName || `PROVIDER_API_KEY`

    const slug = agent.agentName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, `-`)
      .replace(/-+/g, `-`)
      .replace(/^-|-$/g, ``)

    return [
      {
        label: `Provider`,
        type: `AI Provider`,
        icon: <CloudQueueIcon sx={{ fontSize: 16 }} />,
        color: theme.palette.primary.main,
        details: [
          providerName,
          ...(provider.providerBrand === `custom` && provider.providerUrl
            ? [provider.providerUrl]
            : []),
        ],
      },
      {
        label: `Secret`,
        type: `Encrypted API Key`,
        icon: <LockOutlinedIcon sx={{ fontSize: 16 }} />,
        color: theme.palette.warning.main,
        details: [secretName],
      },
      {
        label: `Project`,
        type: `Project`,
        icon: <AccountTreeIcon sx={{ fontSize: 16 }} />,
        color: theme.palette.success.main,
        details: [agent.projectName],
      },
      {
        label: `Agent`,
        type: `AI Agent`,
        icon: <SmartToyOutlinedIcon sx={{ fontSize: 16 }} />,
        color: theme.palette.secondary.main,
        details: [
          agent.agentName,
          `Model: ${modelName}`,
          ...(agent.agentDescription ? [agent.agentDescription] : []),
        ],
      },
      {
        label: `Endpoint`,
        type: `API Endpoint`,
        icon: <ApiIcon sx={{ fontSize: 16 }} />,
        color: theme.palette.error.main,
        details: [`POST /ai/${slug}`],
      },
    ]
  }, [provider, agent, template, theme])

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1.5, mt: 2, pb: 3 }}>
      <SectionHeader sx={{ mb: 2 }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 18, color: `success.main` }} />
        <Typography
          variant='subtitle2'
          sx={{ fontWeight: 600 }}
        >
          Ready to create 5 resources
        </Typography>
      </SectionHeader>

      <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1.5, px: 3 }}>
        {items.map((item) => (
          <ResourceCard
            key={item.label}
            elevation={0}
          >
            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
              <ResourceHeader>
                <SectionIcon color={item.color}>{item.icon}</SectionIcon>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: `flex`, alignItems: `center`, gap: 1 }}>
                    <Typography
                      variant='subtitle2'
                      sx={{ fontWeight: 600 }}
                    >
                      {item.label}
                    </Typography>
                    <Chip
                      size='small'
                      label={item.type}
                      variant='outlined'
                      sx={{ height: 20, fontSize: `0.65rem` }}
                    />
                  </Box>
                </Box>
              </ResourceHeader>
              {item.details.map((detail, i) => (
                <Typography
                  key={i}
                  variant='body2'
                  color='text.secondary'
                  sx={{
                    ml: 5.25,
                    lineHeight: 1.6,
                    fontSize: i === 0 ? `0.8125rem` : `0.75rem`,
                    fontFamily: i === 0 ? undefined : `monospace`,
                  }}
                >
                  {detail}
                </Typography>
              ))}
            </CardContent>
          </ResourceCard>
        ))}
      </Box>
    </Box>
  )
}
