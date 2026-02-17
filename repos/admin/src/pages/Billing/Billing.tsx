import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { useSearchParams } from 'react-router'
import { CurrentPlan, PlanCard } from '@TAF/components/Billing'
import { usePaymentPlans, useSubscription } from '@TAF/state/selectors'
import {
  fetchPaymentPlans,
  createCheckoutSession,
  fetchCurrentSubscription,
} from '@TAF/actions'
import {
  Box,
  Tab,
  Tabs,
  Card,
  Grid,
  Alert,
  Skeleton,
  Container,
  Typography,
  CardContent,
} from '@mui/material'

export type TBilling = {}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props

  return (
    <div
      role='tabpanel'
      hidden={value !== index}
      id={`billing-tabpanel-${index}`}
      aria-labelledby={`billing-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export const Billing = (props: TBilling) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tabValue, setTabValue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [plans] = usePaymentPlans()
  const [subscription] = useSubscription()

  useEffect(() => {
    const success = searchParams.get('success')
    const cancelled = searchParams.get('cancelled')

    if (success === 'true') {
      toast.success('Subscription Updated', {
        id: 'billing-success',
        description: 'Your subscription has been successfully updated.',
      })
      // Clean up URL params
      setSearchParams({})
      // Reload subscription data
      loadData()
    } else if (cancelled === 'true') {
      toast.info('Checkout Cancelled', {
        id: 'billing-cancelled',
        description: 'You cancelled the checkout process.',
      })
      // Clean up URL params
      setSearchParams({})
    }
  }, [searchParams, setSearchParams])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [subscriptionResp, plansResp] = await Promise.all([
        fetchCurrentSubscription(),
        fetchPaymentPlans(),
      ])

      if (subscriptionResp.error) {
        setError(subscriptionResp.error.message)
        return
      }

      if (plansResp.error) {
        setError(plansResp.error.message)
        return
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const onTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const onUpgrade = async (planId: string) => {
    try {
      setUpgradeLoading(true)

      const successUrl = `${window.location.origin}/billing?success=true`
      const cancelUrl = `${window.location.origin}/billing?cancelled=true`

      const { data, error } = await createCheckoutSession(planId, successUrl, cancelUrl)

      if (error) {
        toast.error('Checkout Error', {
          id: 'billing-checkout-error',
          description: error.message,
        })
        return
      }

      window.location.href = data.url
    } catch (err: any) {
      toast.error('Checkout Error', {
        id: 'billing-checkout-error',
        description: err.message,
      })
      setUpgradeLoading(false)
    }
  }

  return (
    <Page className='tdsk-billing-page'>
      <Container maxWidth='lg'>
        <Box sx={{ mb: 3 }}>
          <Typography
            variant='h4'
            component='h1'
            gutterBottom
          >
            Billing & Plans
          </Typography>
          <Typography
            variant='body1'
            color='text.secondary'
          >
            Manage your subscription and view available plans
          </Typography>
        </Box>

        {loading && (
          <Box>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Skeleton
                  variant='text'
                  width='40%'
                  height={32}
                />
                <Skeleton
                  variant='text'
                  width='60%'
                  height={24}
                  sx={{ mt: 1 }}
                />
                <Skeleton
                  variant='rectangular'
                  height={80}
                  sx={{ mt: 2, borderRadius: 1 }}
                />
              </CardContent>
            </Card>
            <Grid
              container
              spacing={3}
            >
              {[1, 2, 3].map((i) => (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={4}
                  key={i}
                >
                  <Card>
                    <CardContent>
                      <Skeleton
                        variant='text'
                        width='50%'
                        height={28}
                      />
                      <Skeleton
                        variant='text'
                        width='30%'
                        height={40}
                        sx={{ mt: 1 }}
                      />
                      <Skeleton
                        variant='text'
                        width='80%'
                        height={20}
                        sx={{ mt: 1 }}
                      />
                      <Skeleton
                        variant='text'
                        width='80%'
                        height={20}
                      />
                      <Skeleton
                        variant='text'
                        width='80%'
                        height={20}
                      />
                      <Skeleton
                        variant='rectangular'
                        height={36}
                        sx={{ mt: 2, borderRadius: 1 }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {error && (
          <Alert
            severity='error'
            sx={{ mb: 3 }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {!loading && (
          <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs
                value={tabValue}
                onChange={onTabChange}
                aria-label='billing tabs'
              >
                <Tab
                  label='Current Plan'
                  id='billing-tab-0'
                  aria-controls='billing-tabpanel-0'
                />
                <Tab
                  label='Upgrade Plan'
                  id='billing-tab-1'
                  aria-controls='billing-tabpanel-1'
                />
              </Tabs>
            </Box>

            <TabPanel
              value={tabValue}
              index={0}
            >
              <CurrentPlan />
            </TabPanel>

            <TabPanel
              value={tabValue}
              index={1}
            >
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant='h6'
                  gutterBottom
                >
                  Available Plans
                </Typography>
                <Typography
                  variant='body2'
                  color='text.secondary'
                >
                  Choose the plan that best fits your needs
                </Typography>
              </Box>

              {plans?.length === 0 ? (
                <Alert severity='info'>No plans available at this time.</Alert>
              ) : (
                <Grid
                  container
                  spacing={3}
                >
                  {plans.map((plan) => (
                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={4}
                      key={plan.id}
                    >
                      <PlanCard
                        plan={plan}
                        currentTier={subscription?.tier}
                        onUpgrade={onUpgrade}
                        loading={upgradeLoading}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </TabPanel>
          </>
        )}
      </Container>
    </Page>
  )
}

export default Billing
