import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import PricingTierGrid from '@TAF/components/Shared/PricingTierGrid'
import SectionContainer from '@TAF/components/Shared/SectionContainer'
import SectionHeader from '@TAF/components/Shared/SectionHeader'
import CTABanner from '@TAF/components/Landing/CTABanner'
import PageMeta from '@TAF/components/Shared/PageMeta'

type ComparisonRow = {
  resource: string
  free: string
  basic: string
  developer: string
  pro: string
}

const comparisonRows: ComparisonRow[] = [
  { resource: 'Projects', free: '1', basic: '3', developer: '10', pro: 'Unlimited' },
  { resource: 'Members', free: '1', basic: '5', developer: '15', pro: 'Unlimited' },
  { resource: 'Endpoints', free: '5', basic: '25', developer: '100', pro: 'Unlimited' },
  { resource: 'Threads', free: '10', basic: '100', developer: '1,000', pro: 'Unlimited' },
  {
    resource: 'Messages',
    free: '100',
    basic: '1,000',
    developer: '10,000',
    pro: 'Unlimited',
  },
  {
    resource: 'Function Calls',
    free: '50/mo',
    basic: '500/mo',
    developer: '5,000/mo',
    pro: 'Unlimited',
  },
  {
    resource: 'Runtime',
    free: '1 hr/mo',
    basic: '10 hrs/mo',
    developer: '100 hrs/mo',
    pro: 'Unlimited',
  },
  { resource: 'Org Secrets', free: '5', basic: '25', developer: '100', pro: 'Unlimited' },
  {
    resource: 'Project Secrets',
    free: '5',
    basic: '25',
    developer: '100',
    pro: 'Unlimited',
  },
  { resource: 'Organizations', free: '1', basic: '1', developer: '3', pro: 'Unlimited' },
  {
    resource: 'Price',
    free: '$0/mo',
    basic: '$19/mo',
    developer: '$49/mo',
    pro: '$149/mo',
  },
  {
    resource: 'Retention',
    free: '7 days',
    basic: '30 days',
    developer: '90 days',
    pro: '365 days',
  },
]

type FAQItem = {
  question: string
  answer: string
}

const faqItems: FAQItem[] = [
  {
    question: 'Can I switch plans at any time?',
    answer:
      'Yes. You can upgrade or downgrade your plan at any time from the admin dashboard. When upgrading, the new limits take effect immediately. When downgrading, your current billing cycle completes before the change applies, and you will not lose access to any existing resources — only new resource creation will be limited.',
  },
  {
    question: 'What happens if I exceed my quotas?',
    answer:
      'When you reach a quota limit, new resource creation for that type will be blocked until you upgrade your plan or reduce usage. Existing resources continue to function normally — we never delete or disable resources you have already created. You will receive notifications as you approach your limits.',
  },
  {
    question: 'Is there a free trial for paid plans?',
    answer:
      'The Free tier is available indefinitely with no credit card required, so you can explore the platform at your own pace. For paid plans, we offer a 14-day free trial with full access to all features of the selected tier. If you cancel before the trial ends, you will not be charged.',
  },
  {
    question: 'Do you offer custom enterprise plans?',
    answer:
      'Yes. For organizations that need higher limits, custom SLAs, dedicated infrastructure, or specific compliance requirements, we offer tailored enterprise plans. Contact our sales team at enterprise@threadedstack.com to discuss your needs.',
  },
  {
    question: 'How does billing work?',
    answer:
      'All paid plans are billed monthly through Polar.sh. You can pay with any major credit card. Invoices are generated at the start of each billing cycle and are available in your admin dashboard. Annual billing with a discount is coming soon.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit and debit cards (Visa, Mastercard, American Express) through our payment provider Polar.sh. All transactions are processed securely and we never store your card details on our servers.',
  },
]

const Pricing = () => (
  <>
    <PageMeta
      title='Pricing'
      description='Simple, transparent pricing for Threaded Stack. Start free, scale as you grow with Basic, Developer, and Pro plans.'
    />
    <Box>
      {/* Mini Hero */}
      <Box
        className='tdsk-mini-hero'
        sx={{
          pt: { xs: 8, md: 12 },
          pb: 0,
          bgcolor: (t) => (t.palette.mode === 'dark' ? '#1A1D21' : '#FAFBFC'),
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: (t) =>
              t.palette.mode === 'dark'
                ? 'radial-gradient(ellipse at 50% 50%, rgba(51,112,222,0.06) 0%, transparent 60%)'
                : 'radial-gradient(ellipse at 50% 50%, rgba(51,112,222,0.03) 0%, transparent 60%)',
          }}
        />
        <Container
          maxWidth='lg'
          sx={{ position: 'relative', textAlign: 'center' }}
        >
          <Typography
            variant='overline'
            sx={{
              color: 'primary.main',
              letterSpacing: 3,
              fontWeight: 600,
              mb: 2,
              display: 'block',
            }}
          >
            PRICING
          </Typography>
          <Typography
            variant='h2'
            sx={{ mb: 2, fontWeight: 700 }}
          >
            Simple, Transparent Pricing
          </Typography>
          <Typography
            variant='body1'
            color='text.secondary'
            sx={{ maxWidth: 560, mx: 'auto' }}
          >
            Start free, scale as you grow. Every plan includes the full platform — you
            only pay for higher limits.
          </Typography>
        </Container>
      </Box>

      {/* Plan Cards */}
      <SectionContainer>
        <Box sx={{ mb: 2 }}>
          <PricingTierGrid />
        </Box>
      </SectionContainer>

      {/* Full Comparison Table */}
      <SectionContainer
        sx={{
          bgcolor: (t) =>
            t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        }}
      >
        <SectionHeader
          overline='COMPARE PLANS'
          title='Full Plan Comparison'
          subtitle='A detailed breakdown of quotas and limits across all tiers.'
        />
        <TableContainer
          component={Paper}
          variant='outlined'
          sx={{ borderRadius: 2 }}
        >
          <Table>
            <TableHead>
              <TableRow
                sx={{
                  bgcolor: (t) =>
                    t.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.04)',
                }}
              >
                <TableCell sx={{ fontWeight: 700, width: '28%' }}>Resource</TableCell>
                <TableCell
                  align='center'
                  sx={{ fontWeight: 700, width: '18%' }}
                >
                  Free
                </TableCell>
                <TableCell
                  align='center'
                  sx={{ fontWeight: 700, width: '18%' }}
                >
                  Basic
                </TableCell>
                <TableCell
                  align='center'
                  sx={{ fontWeight: 700, width: '18%', color: 'primary.main' }}
                >
                  Developer
                </TableCell>
                <TableCell
                  align='center'
                  sx={{ fontWeight: 700, width: '18%' }}
                >
                  Pro
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {comparisonRows.map((row) => (
                <TableRow
                  key={row.resource}
                  sx={{ '&:last-child td': { borderBottom: 0 } }}
                >
                  <TableCell sx={{ fontWeight: 500 }}>{row.resource}</TableCell>
                  <TableCell align='center'>{row.free}</TableCell>
                  <TableCell align='center'>{row.basic}</TableCell>
                  <TableCell
                    align='center'
                    sx={{ fontWeight: 500 }}
                  >
                    {row.developer}
                  </TableCell>
                  <TableCell align='center'>{row.pro}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionContainer>

      {/* FAQ */}
      <SectionContainer>
        <SectionHeader
          overline='FAQ'
          title='Frequently Asked Questions'
          subtitle='Everything you need to know about our pricing and plans.'
        />
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
          {faqItems.map((item) => (
            <Accordion
              key={item.question}
              disableGutters
              elevation={0}
              sx={{
                border: 1,
                borderColor: 'divider',
                '&:not(:last-child)': { borderBottom: 0 },
                '&::before': { display: 'none' },
                '&:first-of-type': { borderTopLeftRadius: 8, borderTopRightRadius: 8 },
                '&:last-of-type': {
                  borderBottomLeftRadius: 8,
                  borderBottomRightRadius: 8,
                },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography
                  variant='subtitle1'
                  sx={{ fontWeight: 600 }}
                >
                  {item.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography
                  variant='body2'
                  color='text.secondary'
                  sx={{ lineHeight: 1.8 }}
                >
                  {item.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </SectionContainer>

      {/* CTA Banner */}
      <CTABanner />
    </Box>
  </>
)

export default Pricing
