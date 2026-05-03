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
  solo: string
  pro: string
  team: string
}

const comparisonRows: ComparisonRow[] = [
  { resource: `Organizations`, free: `1`, solo: `2`, pro: `5`, team: `Unlimited` },
  { resource: `Projects`, free: `2`, solo: `10`, pro: `50`, team: `Unlimited` },
  { resource: `Sandbox Sessions`, free: `1`, solo: `3`, pro: `10`, team: `Unlimited` },
  { resource: `Seats (included)`, free: `1`, solo: `1`, pro: `3`, team: `10` },
  {
    resource: `Additional Seats`,
    free: `\u2014`,
    solo: `\u2014`,
    pro: `+$10/seat/mo`,
    team: `+$8/seat/mo`,
  },
  {
    resource: `Compute`,
    free: `1,000/mo`,
    solo: `10,000/mo`,
    pro: `100,000/mo`,
    team: `Unlimited`,
  },
  {
    resource: `Threads`,
    free: `100`,
    solo: `1,000`,
    pro: `Unlimited`,
    team: `Unlimited`,
  },
  {
    resource: `Messages`,
    free: `500/mo`,
    solo: `10,000/mo`,
    pro: `Unlimited`,
    team: `Unlimited`,
  },
  { resource: `Endpoints`, free: `3`, solo: `20`, pro: `Unlimited`, team: `Unlimited` },
  { resource: `Secrets`, free: `5`, solo: `25`, pro: `Unlimited`, team: `Unlimited` },
  {
    resource: `Retention`,
    free: `7 days`,
    solo: `30 days`,
    pro: `90 days`,
    team: `365 days`,
  },
]

type FAQItem = {
  question: string
  answer: string
}

const faqItems: FAQItem[] = [
  {
    question: `Can I switch plans at any time?`,
    answer: `Yes. You can upgrade or downgrade your plan at any time from the admin dashboard. When upgrading, the new limits take effect immediately. When downgrading, your current billing cycle completes before the change applies, and you will not lose access to any existing resources — only new resource creation will be limited.`,
  },
  {
    question: `What happens if I exceed my quotas?`,
    answer: `When you reach a quota limit, new resource creation for that type will be blocked until you upgrade your plan or reduce usage. Existing resources continue to function normally — we never delete or disable resources you have already created. You will receive notifications as you approach your limits.`,
  },
  {
    question: `How do I get started?`,
    answer: `Sign up for the Free tier — no credit card required. You get a fully functional sandbox environment with one concurrent session. When you need more sessions, projects, or team seats, upgrade from the admin dashboard.`,
  },
  {
    question: `Do you offer custom enterprise plans?`,
    answer: `Yes. For organizations that need higher limits, custom SLAs, dedicated infrastructure, or specific compliance requirements, we offer tailored enterprise plans. Contact our sales team at enterprise@threadedstack.com to discuss your needs.`,
  },
  {
    question: `How does billing work?`,
    answer: `All paid plans are billed monthly. You can upgrade or downgrade at any time from the admin dashboard. Invoices are generated at the start of each billing cycle and available in your account settings.`,
  },
  {
    question: `What counts as a sandbox session?`,
    answer: `A sandbox session is one active, running sandbox pod. When a sandbox is stopped or idle-timed-out, it no longer counts against your session limit. You can have as many configured sandboxes as your project limit allows — the session limit only governs how many run simultaneously.`,
  },
  {
    question: `How does seat-based pricing work?`,
    answer: `The Pro plan includes 3 seats and the Team plan includes 10 seats at the base price. If you need more, additional seats are billed per member per month — $10/seat on Pro, $8/seat on Team. Seats are prorated when added mid-cycle, and you are only charged for active members.`,
  },
]

const Pricing = () => (
  <>
    <PageMeta
      title='Pricing'
      description='Simple, transparent pricing for Threaded Stack. Start free, scale as you grow with Solo, Pro, and Team plans. Every plan includes managed sandboxes, egress proxy, and secret management.'
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
                  Solo
                </TableCell>
                <TableCell
                  align='center'
                  sx={{ fontWeight: 700, width: '18%', color: 'primary.main' }}
                >
                  Pro
                </TableCell>
                <TableCell
                  align='center'
                  sx={{ fontWeight: 700, width: '18%' }}
                >
                  Team
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
                  <TableCell align='center'>{row.solo}</TableCell>
                  <TableCell
                    align='center'
                    sx={{ fontWeight: 500 }}
                  >
                    {row.pro}
                  </TableCell>
                  <TableCell align='center'>{row.team}</TableCell>
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
