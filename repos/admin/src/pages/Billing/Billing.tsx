import type { TSubscriptionTier, Invoice } from '@tdsk/domain'

import { toast } from 'sonner'
import { useState } from 'react'
import { useRevalidator } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { createCheckoutSession } from '@TAF/actions'
import { Download as DownloadIcon } from '@mui/icons-material'
import { CurrentPlan, PlanCard } from '@TAF/components/Billing'
import { resetInvoices, resetSubscription, resetPaymentPlans } from '@TAF/state/accessors'
import { usePaymentPlans, useSubscription, useInvoices } from '@TAF/state/selectors'
import {
  Box,
  Tab,
  Tabs,
  Card,
  Chip,
  Grid,
  Link,
  Alert,
  Table,
  TableRow,
  Container,
  TableBody,
  TableCell,
  TableHead,
  Typography,
  TableContainer,
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

const formatInvoiceDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatCents = (amount: number, currency: string = 'usd'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

const getInvoiceStatusColor = (
  status: string
): 'default' | 'success' | 'warning' | 'error' | 'primary' => {
  switch (status) {
    case 'paid':
      return 'success'
    case 'open':
      return 'primary'
    case 'draft':
      return 'default'
    case 'void':
    case 'uncollectible':
      return 'error'
    default:
      return 'warning'
  }
}

const InvoiceList = ({ invoices }: { invoices: Invoice[] | undefined }) => {
  if (!invoices?.length) {
    return <Alert severity='info'>No payment history available.</Alert>
  }

  return (
    <TableContainer component={Card}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Amount</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align='right'>Invoice</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id || invoice.stripeInvoiceId}>
              <TableCell>{formatInvoiceDate(invoice.period)}</TableCell>
              <TableCell>{formatCents(invoice.amount, invoice.currency)}</TableCell>
              <TableCell>
                <Chip
                  size='small'
                  label={invoice.status}
                  color={getInvoiceStatusColor(invoice.status)}
                />
              </TableCell>
              <TableCell align='right'>
                {invoice.invoiceUrl ? (
                  <Link
                    href={invoice.invoiceUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                  >
                    <DownloadIcon fontSize='small' />
                    PDF
                  </Link>
                ) : (
                  <Typography
                    variant='body2'
                    color='text.secondary'
                  >
                    --
                  </Typography>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export const Billing = (props: TBilling) => {
  const revalidator = useRevalidator()
  const [tabValue, setTabValue] = useState(0)
  const [upgradeLoading, setUpgradeLoading] = useState(false)

  const [invoices] = useInvoices()
  const [plans] = usePaymentPlans()
  const [subscription] = useSubscription()
  const currentPrice = plans?.find(
    (p) => p.name.toLowerCase() === subscription?.tier?.toLowerCase()
  )?.price

  const onTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const onUpgrade = async (tier: TSubscriptionTier) => {
    setUpgradeLoading(true)
    try {
      const successUrl = `${window.location.origin}/billing?success=true`
      const cancelUrl = `${window.location.origin}/billing?cancelled=true`

      const { data, error } = await createCheckoutSession(tier, successUrl, cancelUrl)

      if (error) {
        toast.error(`Checkout Error`, {
          id: `billing-checkout-error`,
          description: error.message,
        })
        return
      }

      if (data.updated || data.cancelled) {
        toast.success(`Subscription Updated`, {
          id: `billing-update-success`,
          description: data.message,
        })
        resetSubscription()
        resetPaymentPlans()
        resetInvoices()
        revalidator.revalidate()
        return
      }

      if (data.url) {
        window.location.href = data.url
        return
      }

      toast.error(`Checkout Error`, {
        id: `billing-checkout-error`,
        description: `Unexpected response from checkout. Please try again.`,
      })
    } catch (err: unknown) {
      toast.error(`Checkout Error`, {
        id: `billing-checkout-error`,
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
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
            <Tab
              label='Payment History'
              id='billing-tab-2'
              aria-controls='billing-tabpanel-2'
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

          {!plans?.length ? (
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
                    currentPrice={currentPrice}
                    currentTier={subscription?.tier}
                    onUpgrade={onUpgrade}
                    loading={upgradeLoading}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>

        <TabPanel
          value={tabValue}
          index={2}
        >
          <Box sx={{ mb: 3 }}>
            <Typography
              variant='h6'
              gutterBottom
            >
              Payment History
            </Typography>
            <Typography
              variant='body2'
              color='text.secondary'
            >
              View your past invoices and download receipts
            </Typography>
          </Box>
          <InvoiceList invoices={invoices} />
        </TabPanel>
      </Container>
    </Page>
  )
}

export default Billing
