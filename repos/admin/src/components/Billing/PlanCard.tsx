import type { Plan, TSubscriptionTier } from '@tdsk/domain'

import { useMemo } from 'react'
import { Button } from '@tdsk/components'
import { styled } from '@mui/material/styles'
import { ESubscriptionTier } from '@tdsk/domain'
import { CheckCircle } from '@mui/icons-material'
import { wordCaps } from '@keg-hub/jsutils/wordCaps'
import ArrowCircleUpIcon from '@mui/icons-material/ArrowCircleUp'
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown'
import {
  Box,
  Card,
  Chip,
  List,
  Divider,
  ListItem,
  Typography,
  CardContent,
  CardActions,
  ListItemText,
} from '@mui/material'

const StyledCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== 'highlighted',
})<{ highlighted?: boolean }>(({ theme, highlighted }) => ({
  height: `100%`,
  display: `flex`,
  flexDirection: `column`,
  transition: `all 0.2s`,
  border: highlighted
    ? `2px solid ${theme.palette.primary.main}`
    : `1px solid ${theme.palette.border.default}`,

  [`&:hover`]: {
    transform: `translateY(-2px)`,
    boxShadow: theme.palette.colors.shadows?.sm,
  },

  [`&.current`]: {
    border: `2px solid ${theme.palette.success.main}`,
  },
}))

const StyledDivider = styled(Divider)(({ theme }) => ({
  opacity: 0.1,
  marginTop: theme.gutter(2),
  marginBottom: theme.gutter(2),
  borderColor: theme.palette.border.alt,
}))

export type TPlanCardProps = {
  plan: Plan
  currentPrice?: number
  currentTier?: string
  onUpgrade: (tier: TSubscriptionTier) => void
  loading?: boolean
}

/**
 * Format compute seconds to human-readable string
 */
const formatCompute = (seconds: number): string => {
  if (seconds === -1) return `Unlimited`
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h`
}

/**
 * Format number with commas
 */
const formatNumber = (num: number): string => {
  if (num == null) return `Unknown`
  if (num === -1) return `Unlimited`
  return num.toLocaleString()
}

const usePlanFeatures = (plan: Plan) => {
  return useMemo(() => {
    if (!plan?.limits) return []

    const { limits } = plan
    return [
      { label: `Organizations`, value: formatNumber(limits.organizations) },
      { label: `Projects`, value: formatNumber(limits.projects) },
      { label: `Endpoints`, value: formatNumber(limits.endpoints) },
      { label: `Compute`, value: formatCompute(limits.compute) },
      { label: `Threads`, value: formatNumber(limits.threads) },
      { label: `Messages`, value: formatNumber(limits.messages) },
      { label: `Secrets`, value: formatNumber(limits.secrets) },
      { label: `Seats`, value: formatNumber(limits.seats) },
      {
        label: `Data Retention`,
        value: `${limits.retention} ${limits.retention === 1 ? 'day' : 'days'}`,
      },
    ]
  }, [plan.limits])
}

export const PlanCard = (props: TPlanCardProps) => {
  const { plan, onUpgrade, currentTier, currentPrice = 0, loading = false } = props

  const features = usePlanFeatures(plan)
  const isCurrent = currentTier?.toLowerCase() === plan.name.toLowerCase()
  const isHighlighted = plan.name.toLowerCase() === ESubscriptionTier.pro
  const targetPrice = plan.price
  const isDowngrade = !isCurrent && targetPrice < currentPrice

  return (
    <StyledCard
      highlighted={isHighlighted}
      className={isCurrent ? 'current' : ''}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
          <Typography
            variant='h5'
            component='h3'
            sx={{ flexGrow: 1 }}
          >
            {wordCaps(plan.name)}
          </Typography>
          {isHighlighted && !isCurrent && (
            <Chip
              size='small'
              label='Recommended'
              color='primary'
            />
          )}
          {isCurrent && (
            <Chip
              size='small'
              label='Current Plan'
              color='primary'
            />
          )}
        </Box>

        <StyledDivider />

        <Typography
          variant='h4'
          sx={{ mb: 1, fontWeight: 'bold' }}
        >
          {plan.price === 0 ? (
            'Free'
          ) : (
            <>
              ${plan.price / 100}
              <Typography
                component='span'
                variant='body2'
                color='text.secondary'
              >
                /month
              </Typography>
            </>
          )}
        </Typography>

        {plan.seatPrice > 0 && (
          <Typography
            variant='body2'
            color='text.secondary'
            sx={{ mb: 2 }}
          >
            +${plan.seatPrice / 100}/seat/mo for additional seats
          </Typography>
        )}

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
          disabled={isCurrent || loading}
          color={isDowngrade ? `warning` : `success`}
          variant={isCurrent ? `outlined` : `contained`}
          onClick={() => onUpgrade(plan.name as TSubscriptionTier)}
          Icon={isDowngrade ? <ArrowCircleDownIcon /> : <ArrowCircleUpIcon />}
        >
          {loading
            ? `Processing...`
            : isCurrent
              ? `Current Plan`
              : isDowngrade
                ? `Downgrade`
                : `Upgrade`}
        </Button>
      </CardActions>
    </StyledCard>
  )
}
