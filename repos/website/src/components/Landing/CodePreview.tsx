import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import SectionContainer from '@TAF/components/Shared/SectionContainer'
import SectionHeader from '@TAF/components/Shared/SectionHeader'
import CodeBlock from '@TAF/components/Shared/CodeBlock'

const codeExample = `# Authenticate with your API key
tsa login tdsk_live_abc123

# Launch a Claude Code sandbox with file sync
tsa run claude-code
# → Syncing files to /workspace...
# → Starting Claude Code runtime...
# → Connected. Session: sess_k8j2m

# Share the session with a teammate
tsa sessions share sess_k8j2m

# Or SSH directly into the sandbox
tsa ssh my-sandbox`

const CodePreview = () => (
  <SectionContainer id='code-preview'>
    <Grid
      container
      spacing={6}
      alignItems='center'
    >
      <Grid
        item
        xs={12}
        md={5}
      >
        <SectionHeader
          align='left'
          overline='DEVELOPER EXPERIENCE'
          title='One Command to Launch'
        />
        <Typography
          variant='body1'
          color='text.secondary'
          sx={{ mb: 2 }}
        >
          The tsa CLI is the primary interface for Threaded Stack. A single command
          launches a sandbox, syncs your project files, and starts your chosen AI coding
          tool.
        </Typography>
        <Typography
          variant='body1'
          color='text.secondary'
        >
          Manage sessions, share terminals with teammates, and switch between sandbox
          runtimes — all from the command line.
        </Typography>
      </Grid>
      <Grid
        item
        xs={12}
        md={7}
      >
        <CodeBlock
          code={codeExample}
          language='bash'
        />
      </Grid>
    </Grid>
  </SectionContainer>
)

export default CodePreview
