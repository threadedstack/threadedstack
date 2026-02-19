import type { TReviewStep } from '@TAF/types'
import type { ReactNode } from 'react'

import { useMemo } from 'react'
import { Text } from '@tdsk/components'
import { ProviderTemplates } from '@tdsk/domain'
import { styled, alpha } from '@mui/material/styles'
import { Box, Card, Chip, CardContent, Typography } from '@mui/material'
import CloudQueueIcon from '@mui/icons-material/CloudQueue'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined'
import ApiIcon from '@mui/icons-material/Api'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'

type TReviewItem = {
  label: string
  type: string
  icon: ReactNode
  color: string
  details: string[]
}

const ReviewHeader = styled(Box)(({ theme }) => ({
  display: `flex`,
  alignItems: `center`,
  gap: theme.spacing(1),
  marginBottom: theme.spacing(2),
}))

const ResourceCard = styled(Card)(({ theme }) => ({
  borderRadius: theme.spacing(1.5),
  border: `1px solid ${theme.palette.divider}`,
  transition: `border-color 0.2s ease`,
  '&:hover': {
    borderColor: theme.palette.primary.light,
  },
}))

const ResourceHeader = styled(Box)(({ theme }) => ({
  display: `flex`,
  alignItems: `center`,
  gap: theme.spacing(1.25),
  marginBottom: theme.spacing(0.75),
}))

const ResourceIcon = styled(Box, {
  shouldForwardProp: (p) => p !== `color`,
})<{ color: string }>(({ theme, color }) => ({
  width: 30,
  height: 30,
  display: `flex`,
  alignItems: `center`,
  justifyContent: `center`,
  borderRadius: theme.spacing(0.75),
  backgroundColor: alpha(color, 0.1),
  color,
  flexShrink: 0,
}))

export const ReviewStep = (props: TReviewStep) => {
  const { provider, agent } = props
  const template = ProviderTemplates[provider.providerBrand]

  const items = useMemo<TReviewItem[]>(() => {
    const providerName =
      provider.providerBrand === `custom`
        ? provider.providerName || `Custom Provider`
        : template?.name || provider.providerBrand

    const modelName =
      template?.models?.find((m) => m.id === provider.model)?.name || provider.model

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
        color: `#3370DE`,
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
        color: `#D97706`,
        details: [secretName],
      },
      {
        label: `Project`,
        type: `Project`,
        icon: <AccountTreeIcon sx={{ fontSize: 16 }} />,
        color: `#059669`,
        details: [agent.projectName],
      },
      {
        label: `Agent`,
        type: `AI Agent`,
        icon: <SmartToyOutlinedIcon sx={{ fontSize: 16 }} />,
        color: `#7C3AED`,
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
        color: `#E11D48`,
        details: [`POST /ai/${slug}`],
      },
    ]
  }, [provider, agent, template])

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1.5, mt: 2 }}>
      <ReviewHeader>
        <CheckCircleOutlineIcon sx={{ fontSize: 18, color: `success.main` }} />
        <Typography
          variant='subtitle2'
          sx={{
            fontWeight: 600,
            letterSpacing: `0.02em`,
          }}
        >
          Ready to create 5 resources
        </Typography>
      </ReviewHeader>

      <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1.5, px: 3 }}>
        {items.map((item) => (
          <ResourceCard
            key={item.label}
            variant='outlined'
            elevation={0}
          >
            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
              <ResourceHeader>
                <ResourceIcon color={item.color}>{item.icon}</ResourceIcon>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: `flex`, alignItems: `center`, gap: 1 }}>
                    <Text
                      variant='subtitle2'
                      sx={{ fontWeight: 600 }}
                    >
                      {item.label}
                    </Text>
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
                <Text
                  key={i}
                  variant='body2'
                  color='text.secondary'
                  sx={{
                    ml: 5.25,
                    fontFamily: i === 0 ? undefined : `monospace`,
                    fontSize: i === 0 ? `0.8125rem` : `0.75rem`,
                    lineHeight: 1.6,
                  }}
                >
                  {detail}
                </Text>
              ))}
            </CardContent>
          </ResourceCard>
        ))}
      </Box>
    </Box>
  )
}
