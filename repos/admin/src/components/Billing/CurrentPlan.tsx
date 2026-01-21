import { toast } from 'sonner'
import { useState } from 'react'
import { createPortalSession } from '@TAF/actions'
import { wordCaps } from '@keg-hub/jsutils/wordCaps'
import { CheckCircle as CheckIcon } from '@mui/icons-material'
import { usePaymentPlans, useSubscription } from '@TAF/state/selectors'
import {
  Box,
  Card,
  Chip,
  Alert,
  Stack,
  Button,
  Divider,
  Typography,
  CardContent,
} from '@mui/material'

export type TCurrentPlan = {}

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const getStatusColor = (
  status: string
): 'default' | 'primary' | 'success' | 'warning' | 'error' => {
  switch (status.toLowerCase()) {
    case 'active':
      return 'success'
    case 'trialing':
      return 'primary'
    case 'past_due':
      return 'warning'
    case 'canceled':
    case 'incomplete':
    case 'incomplete_expired':
    case 'unpaid':
      return 'error'
    default:
      return 'default'
  }
}

export const CurrentPlan = (props: TCurrentPlan) => {
  const [loading, setLoading] = useState(false)

  const [plans] = usePaymentPlans()
  const [subscription] = useSubscription()

  const currentPlan = plans.find((p) => p.id === subscription?.tier)

  const handleManageSubscription = async () => {
    try {
      setLoading(true)

      const { data, error } = await createPortalSession()

      if (error) {
        toast.error('Portal Error', { description: error.message })
        return
      }

      window.open(data.url, '_blank')
    } catch (err: any) {
      toast.error('Portal Error', { description: err.message })
    } finally {
      setLoading(false)
    }
  }

  if (!subscription) {
    return (
      <Alert
        severity='info'
        sx={{ mb: 3 }}
      >
        No active subscription found. Select a plan below to get started.
      </Alert>
    )
  }

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack
            direction='row'
            justifyContent='space-between'
            alignItems='flex-start'
            sx={{ mb: 2 }}
          >
            <Box>
              <Typography
                variant='h5'
                gutterBottom
              >
                {wordCaps(currentPlan?.name || subscription.tier)}
              </Typography>
              <Chip
                label={subscription.status}
                color={getStatusColor(subscription.status)}
                size='small'
              />
            </Box>
            {currentPlan?.metadata?.price !== undefined && (
              <Typography
                variant='h4'
                color='primary'
              >
                ${currentPlan.metadata.price}
                <Typography
                  component='span'
                  variant='body2'
                  color='text.secondary'
                >
                  /month
                </Typography>
              </Typography>
            )}
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography
            variant='subtitle2'
            color='text.secondary'
            gutterBottom
          >
            Subscription Details
          </Typography>

          <Stack
            spacing={1}
            sx={{ mt: 1, mb: 3 }}
          >
            {subscription.currentPeriodStart && (
              <Box>
                <Typography
                  variant='body2'
                  color='text.secondary'
                  component='span'
                >
                  Period Start:{' '}
                </Typography>
                <Typography
                  variant='body2'
                  component='span'
                >
                  {formatDate(subscription.currentPeriodStart)}
                </Typography>
              </Box>
            )}

            {subscription.currentPeriodEnd && (
              <Box>
                <Typography
                  variant='body2'
                  color='text.secondary'
                  component='span'
                >
                  Period End:{' '}
                </Typography>
                <Typography
                  variant='body2'
                  component='span'
                >
                  {formatDate(subscription.currentPeriodEnd)}
                </Typography>
              </Box>
            )}

            {subscription.cancelAtPeriodEnd && (
              <Alert
                severity='warning'
                sx={{ mt: 1 }}
              >
                Your subscription will be canceled at the end of the current period.
              </Alert>
            )}
          </Stack>

          {currentPlan?.metadata && (
            <>
              <Divider sx={{ my: 2 }} />

              <Typography
                variant='subtitle2'
                color='text.secondary'
                gutterBottom
              >
                Plan Features
              </Typography>

              <Stack
                spacing={1}
                sx={{ mt: 1 }}
              >
                {currentPlan.metadata.projects !== undefined && (
                  <Stack
                    direction='row'
                    spacing={1}
                    alignItems='center'
                  >
                    <CheckIcon
                      fontSize='small'
                      color='success'
                    />
                    <Typography variant='body2'>
                      {currentPlan.metadata.projects === -1
                        ? 'Unlimited'
                        : currentPlan.metadata.projects}{' '}
                      Projects
                    </Typography>
                  </Stack>
                )}

                {currentPlan.metadata.endpoints !== undefined && (
                  <Stack
                    direction='row'
                    spacing={1}
                    alignItems='center'
                  >
                    <CheckIcon
                      fontSize='small'
                      color='success'
                    />
                    <Typography variant='body2'>
                      {currentPlan.metadata.endpoints === -1
                        ? 'Unlimited'
                        : currentPlan.metadata.endpoints}{' '}
                      Endpoints
                    </Typography>
                  </Stack>
                )}

                {currentPlan.metadata.members !== undefined && (
                  <Stack
                    direction='row'
                    spacing={1}
                    alignItems='center'
                  >
                    <CheckIcon
                      fontSize='small'
                      color='success'
                    />
                    <Typography variant='body2'>
                      {currentPlan.metadata.members === -1
                        ? 'Unlimited'
                        : currentPlan.metadata.members}{' '}
                      Team Members
                    </Typography>
                  </Stack>
                )}

                {currentPlan.metadata.runtime !== undefined && (
                  <Stack
                    direction='row'
                    spacing={1}
                    alignItems='center'
                  >
                    <CheckIcon
                      fontSize='small'
                      color='success'
                    />
                    <Typography variant='body2'>
                      {currentPlan.metadata.runtime === -1
                        ? 'Unlimited'
                        : `${currentPlan.metadata.runtime} seconds`}{' '}
                      Runtime
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </>
          )}

          <Box sx={{ mt: 3 }}>
            <Button
              variant='outlined'
              onClick={handleManageSubscription}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Manage Subscription'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
