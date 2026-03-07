import Box from '@mui/material/Box'
import SectionContainer from '@TAF/components/Shared/SectionContainer'
import SectionHeader from '@TAF/components/Shared/SectionHeader'
import StepItem from '@TAF/components/Shared/StepItem'

const steps = [
  {
    number: 1,
    title: 'Create an Organization',
    description:
      'Set up your workspace and invite team members to collaborate on AI agent projects.',
  },
  {
    number: 2,
    title: 'Configure an Agent',
    description:
      "Define your AI agent's capabilities, connect tools, and set behavioral parameters.",
  },
  {
    number: 3,
    title: 'Connect a Provider',
    description:
      'Link your preferred AI provider — OpenAI, Anthropic, or any compatible LLM service.',
  },
  {
    number: 4,
    title: 'Start Building',
    description:
      'Deploy and interact via the REST API, WebSocket, admin dashboard, or REPL CLI.',
  },
]

const HowItWorks = () => (
  <SectionContainer
    id='how-it-works'
    className='tdsk-hw-section'
    sx={{
      bgcolor: (t) =>
        t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
    }}
  >
    <SectionHeader
      overline='HOW IT WORKS'
      title='Up and Running in Minutes'
      subtitle='Four simple steps from zero to a fully operational AI agent platform.'
    />
    <Box
      className='tdsk-hw-items-box'
      sx={{
        display: 'flex',
        position: 'relative',
        gap: { xs: 4, md: 0 },
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'center', md: 'flex-start' },
      }}
    >
      {/* Animated connecting line (desktop only) */}
      <Box
        className='tdsk-hw-items-line'
        sx={{
          display: { xs: 'none', md: 'block' },
          position: 'absolute',
          top: 24,
          left: '12.5%',
          right: '12.5%',
          height: 2,
          bgcolor: 'divider',
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '100%',
            background: 'linear-gradient(90deg, transparent, #3370DE, transparent)',
            animation: 'lineFlow 3s ease-in-out infinite',
          },
          '@keyframes lineFlow': {
            '0%': { opacity: 0.3, transform: 'scaleX(0.3)', transformOrigin: 'left' },
            '50%': { opacity: 1, transform: 'scaleX(1)' },
            '100%': { opacity: 0.3, transform: 'scaleX(0.3)', transformOrigin: 'right' },
          },
        }}
      />
      {steps.map((step) => (
        <StepItem
          key={step.number}
          {...step}
        />
      ))}
    </Box>
  </SectionContainer>
)

export default HowItWorks
