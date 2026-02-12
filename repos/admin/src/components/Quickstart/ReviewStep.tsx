import type { TReviewStep } from '@TAF/types'

import { useMemo } from 'react'
import { Text } from '@tdsk/components'
import { ProviderTemplates } from '@tdsk/domain'
import { Box, Card, Chip, CardContent } from '@mui/material'

type TReviewItem = {
  label: string
  type: string
  details: string[]
}

export const ReviewStep = (props: TReviewStep) => {
  const { provider, agent } = props
  const template = ProviderTemplates[provider.providerTemp]

  const items = useMemo<TReviewItem[]>(() => {
    const providerName =
      provider.providerTemp === `custom`
        ? provider.providerName || `Custom Provider`
        : template?.name || provider.providerTemp

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
        details: [
          providerName,
          ...(provider.providerTemp === `custom` && provider.providerUrl
            ? [provider.providerUrl]
            : []),
        ],
      },
      {
        label: `Secret`,
        type: `Encrypted API Key`,
        details: [secretName],
      },
      {
        label: `Project`,
        type: `Project`,
        details: [agent.projectName],
      },
      {
        label: `Agent`,
        type: `AI Agent`,
        details: [
          agent.agentName,
          `Model: ${modelName}`,
          ...(agent.agentDescription ? [agent.agentDescription] : []),
        ],
      },
      {
        label: `Endpoint`,
        type: `API Endpoint`,
        details: [`POST /ai/${slug}`],
      },
    ]
  }, [provider, agent, template])

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
      <Text
        variant='subtitle2'
        color='text.secondary'
      >
        The following resources will be created:
      </Text>

      {items.map((item) => (
        <Card
          key={item.label}
          variant='outlined'
        >
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: `flex`, alignItems: `center`, gap: 1, mb: 0.5 }}>
              <Text variant='subtitle2'>{item.label}</Text>
              <Chip
                size='small'
                label={item.type}
                variant='outlined'
              />
            </Box>
            {item.details.map((detail, i) => (
              <Text
                key={i}
                variant='body2'
                color='text.secondary'
                sx={{
                  fontFamily: i === 0 ? undefined : `monospace`,
                  fontSize: i === 0 ? undefined : `0.8rem`,
                }}
              >
                {detail}
              </Text>
            ))}
          </CardContent>
        </Card>
      ))}
    </Box>
  )
}
