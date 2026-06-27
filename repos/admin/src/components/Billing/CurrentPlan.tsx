import { toast } from 'sonner'
import { useState } from 'react'
import { ESubscriptionTier } from '@tdsk/domain'
import { PlanSections } from '@TAF/constants/values'
import { wordCaps } from '@keg-hub/jsutils/wordCaps'
import { formatDate } from '@TAF/utils/transforms/date'
import { statusColor } from '@TAF/utils/transforms/status'
import { CheckCircle as CheckIcon } from '@mui/icons-material'
import { cancelSubscription, createPortalSession } from '@TAF/actions'
import { usePaymentPlans, useSubscription } from '@TAF/state/selectors'
import {
  Box,
  Card,
  Chip,
  Alert,
  Stack,
  Button,
  Dialog,
  Divider,
  Typography,
  CardContent,
  DialogTitle,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'

export type TCurrentPlan = {}

export const CurrentPlan = (props: TCurrentPlan) => {
  const [loading, setLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const [plans] = usePaymentPlans()
  const [subscription] = useSubscription()

  const currentPlan = plans?.find((p) => p.id === subscription?.tier)
  const canCancel =
    subscription &&
    subscription.tier !== ESubscriptionTier.free &&
    subscription.status === `active` &&
    !subscription.cancelAtPeriodEnd

  const onCancelSubscription = async () => {
    try {
      setCancelLoading(true)
      setCancelDialogOpen(false)

      const { error } = await cancelSubscription()

      if (error) {
        toast.error(`Cancellation Error`, { description: error.message })
        return
      }

      toast.success(`Subscription Cancelled`, {
        description: `Your subscription will remain active until the end of the current billing period.`,
      })
    } catch (err: any) {
      toast.error(`Cancellation Error`, { description: err.message })
    } finally {
      setCancelLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    try {
      setLoading(true)

      const { data, error } = await createPortalSession()

      if (error) {
        toast.error(`Portal Error`, { description: error.message })
        return
      }

      window.open(data.url, `_blank`)
    } catch (err: any) {
      toast.error(`Portal Error`, { description: err.message })
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
                size='small'
                label={subscription.status}
                color={statusColor(subscription.status)}
              />
            </Box>
            {currentPlan?.price !== undefined && (
              <Typography
                variant='h4'
                color='primary'
              >
                {currentPlan.price === 0 ? (
                  'Free'
                ) : (
                  <>
                    ${currentPlan.price / 100}
                    <Typography
                      variant='body2'
                      component='span'
                      color='text.secondary'
                    >
                      /month
                    </Typography>
                  </>
                )}
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
                  component='span'
                  color='text.secondary'
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

          {currentPlan?.limits && (
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
                {PlanSections.filter(
                  ({ key }) => currentPlan.limits[key] !== undefined
                ).map(({ key, label, suffix }) => {
                  const value = currentPlan.limits[key]
                  const display =
                    value === -1 ? 'Unlimited' : suffix ? `${value} ${suffix}` : value

                  return (
                    <Stack
                      key={key}
                      direction='row'
                      spacing={1}
                      alignItems='center'
                    >
                      <CheckIcon
                        fontSize='small'
                        color='success'
                      />
                      <Typography variant='body2'>
                        {display} {label}
                      </Typography>
                    </Stack>
                  )
                })}

                {currentPlan.limits.seats > 1 && (
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
                      {subscription?.seats || 1} of {currentPlan.limits.seats} seats used
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </>
          )}

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant='outlined'
              disabled={loading}
              onClick={handleManageSubscription}
            >
              {loading ? 'Loading...' : 'Manage Subscription'}
            </Button>

            {canCancel && (
              <Button
                color='error'
                variant='outlined'
                disabled={cancelLoading}
                onClick={() => setCancelDialogOpen(true)}
              >
                {cancelLoading ? 'Cancelling...' : 'Cancel Subscription'}
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
      >
        <DialogTitle>Cancel Subscription</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your subscription will remain active until the end of the current billing
            period
            {subscription?.currentPeriodEnd
              ? ` (${formatDate(subscription.currentPeriodEnd)})`
              : ``}
            . After that, you will be moved to the Free plan.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Keep Subscription</Button>
          <Button
            color='error'
            onClick={onCancelSubscription}
          >
            Confirm Cancellation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
