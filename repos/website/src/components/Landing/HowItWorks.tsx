import Box from '@mui/material/Box'
import StepItem from '@TAF/components/Shared/StepItem'
import SectionHeader from '@TAF/components/Shared/SectionHeader'
import SectionContainer from '@TAF/components/Shared/SectionContainer'

const steps = [
  {
    number: 1,
    title: `Install the TSA CLI`,
    description: `Install the CLI with a single command and authenticate with your API key or browser login.`,
  },
  {
    number: 2,
    title: `Add Your Credentials`,
    description: `Store your LLM provider API keys as encrypted secrets. They are never exposed to sandboxes directly, instead they are resolved through the egress proxy.`,
  },
  {
    number: 3,
    title: `Choose a Runtime`,
    description: `Select from built-in presets like Claude Code, Codex, OpenCode, Antigravity, OpenClaw, or configure a custom runtime with your own tooling.`,
  },
  {
    number: 4,
    title: `Run Your Sandbox`,
    description: `Execute tsa run to launch your sandbox, sync files, and start coding with AI. Share sessions with teammates or switch to the browser UI.`,
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
      title='From Install to AI Sandbox in 60 Seconds'
      subtitle='Four steps to a fully configured, secure AI tool environment.'
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
