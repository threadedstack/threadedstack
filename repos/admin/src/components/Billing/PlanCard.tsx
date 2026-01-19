import type { TPlanData } from '@TAF/types'

import {
  Box,
  Card,
  Chip,
  List,
  Button,
  ListItem,
  Typography,
  CardContent,
  CardActions,
  ListItemText,
} from '@mui/material'
import { styled } from '@mui/material/styles'
import { CheckCircle } from '@mui/icons-material'

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'all 0.2s',
  border: '1px solid rgba(0, 0, 0, 0.12)',

  '&:hover': {
    boxShadow: theme.shadows[4],
    transform: 'translateY(-4px)',
  },

  '&.current': {
    border: `2px solid ${theme.palette.primary.main}`,
  },
}))

export type TPlanCardProps = {
  plan: TPlanData
  currentTier?: string
  onUpgrade: (planId: string) => void
  loading?: boolean
}

/**
 * Format runtime seconds to human-readable string
 */
const formatRuntime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h`
}

/**
 * Format number with commas
 */
const formatNumber = (num: number): string => {
  if (num === -1) return 'Unlimited'
  return num.toLocaleString()
}

export const PlanCard = (props: TPlanCardProps) => {
  const { plan, currentTier, onUpgrade, loading = false } = props
  const { metadata } = plan
  const isCurrent = currentTier?.toLowerCase() === plan.name.toLowerCase()

  const features = [
    { label: 'Organizations', value: formatNumber(metadata.organizations) },
    { label: 'Projects', value: formatNumber(metadata.projects) },
    { label: 'Team Members', value: formatNumber(metadata.members) },
    { label: 'Endpoints', value: formatNumber(metadata.endpoints) },
    { label: 'Function Calls', value: formatNumber(metadata.functionCalls) },
    { label: 'Runtime', value: formatRuntime(metadata.runtime) },
    { label: 'Threads', value: formatNumber(metadata.threads) },
    { label: 'Messages', value: formatNumber(metadata.messages) },
    { label: 'Org Secrets', value: formatNumber(metadata.orgSecrets) },
    { label: 'Project Secrets', value: formatNumber(metadata.projectSecrets) },
    { label: 'Data Retention', value: `${metadata.retention} months` },
  ]

  return (
    <StyledCard className={isCurrent ? 'current' : ''}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
          <Typography
            variant='h5'
            component='h3'
            sx={{ flexGrow: 1 }}
          >
            {plan.name}
          </Typography>
          {isCurrent && (
            <Chip
              size='small'
              label='Current Plan'
              color='primary'
            />
          )}
        </Box>

        <Typography
          variant='h4'
          sx={{ mb: 3, fontWeight: 'bold' }}
        >
          ${metadata.price}
          <Typography
            component='span'
            variant='body2'
            color='text.secondary'
          >
            /month
          </Typography>
        </Typography>

        <List dense>
          {features.map((feature) => (
            <ListItem
              key={feature.label}
              disableGutters
              sx={{ py: 0.5 }}
            >
              <CheckCircle sx={{ mr: 1, fontSize: 16, color: 'primary.main' }} />
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant='body2'>{feature.label}</Typography>
                    <Typography
                      variant='body2'
                      fontWeight='bold'
                    >
                      {feature.value}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </CardContent>

      <CardActions sx={{ p: 2, pt: 0 }}>
        <Button
          fullWidth
          size='large'
          variant={isCurrent ? 'outlined' : 'contained'}
          onClick={() => onUpgrade(plan.id)}
          disabled={isCurrent || loading}
        >
          {loading ? 'Processing...' : isCurrent ? 'Current Plan' : 'Upgrade'}
        </Button>
      </CardActions>
    </StyledCard>
  )
}
