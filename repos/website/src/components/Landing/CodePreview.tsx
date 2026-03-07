import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import SectionContainer from '@TAF/components/Shared/SectionContainer'
import SectionHeader from '@TAF/components/Shared/SectionHeader'
import CodeBlock from '@TAF/components/Shared/CodeBlock'

const codeExample = `# Create an AI agent session
curl -X POST https://api.threadedstack.app/ai/sessions \\
  -H "Authorization: Bearer tdsk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "agent_abc123",
    "orgId": "org_xyz789"
  }'

# Response
{
  "sessionId": "sess_k8j2m",
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "wsUrl": "wss://api.threadedstack.app/ai/ws?token=..."
}`

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
          title='Simple, Powerful APIs'
        />
        <Typography
          variant='body1'
          color='text.secondary'
          sx={{ mb: 2 }}
        >
          Get started with a single API call. Create sessions, send messages, and receive
          streaming responses through a clean REST API or WebSocket connection.
        </Typography>
        <Typography
          variant='body1'
          color='text.secondary'
        >
          Every endpoint is authenticated, rate-limited, and fully documented. Use our
          SDKs or call the API directly — your choice.
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
