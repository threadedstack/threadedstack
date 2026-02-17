import { useState } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { ThreadsTab } from '@TAF/components/AI/ThreadsTab'
import { MessagesTab } from '@TAF/components/AI/MessagesTab'
import { Box, Tab, Tabs, Paper, Typography } from '@mui/material'
import { useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'

export type TProjectAI = {}

enum ETab {
  threads = `threads`,
  messages = `messages`,
}

export const ProjectAI = (props: TProjectAI) => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [currentTab, setCurrentTab] = useState<ETab>(ETab.threads)

  const onTabChange = (_event: React.SyntheticEvent, val: ETab) => {
    setCurrentTab(val)
  }

  if (!orgId || !projectId) return null

  return (
    <Page className='tdsk-project-ai-page'>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant='h5'
          component='h1'
        >
          AI Configuration
        </Typography>
        <Typography
          variant='body2'
          color='text.secondary'
          sx={{ mt: 1 }}
        >
          Manage AI providers, threads, messages, and generated assets for your project.
        </Typography>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={onTabChange}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            label='Threads'
            value={ETab.threads}
          />
          <Tab
            label='Messages'
            value={ETab.messages}
          />
          {/* Assets tab hidden until backend /assets endpoint is implemented (BUG #53) */}
        </Tabs>
      </Paper>

      <Box>
        {/* Assets tab hidden until backend /assets endpoint is implemented (BUG #53) */}
        {currentTab === ETab.threads && <ThreadsTab />}
        {currentTab === ETab.messages && <MessagesTab />}
      </Box>
    </Page>
  )
}

export default ProjectAI
