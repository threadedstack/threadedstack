import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'
import { ThreadsTab } from '@TAF/components/AI/ThreadsTab'
import { MessagesTab } from '@TAF/components/AI/MessagesTab'
import { AssetsTab } from '@TAF/components/AI/AssetsTab'
import { Box, Tab, Tabs, Paper, Typography } from '@mui/material'
import { useState } from 'react'

export type TProjectThreads = {}

type TabValue = 'threads' | 'messages' | 'assets'

export const ProjectThreads = (props: TProjectThreads) => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [currentTab, setCurrentTab] = useState<TabValue>('threads')

  const handleTabChange = (_event: React.SyntheticEvent, newValue: TabValue) => {
    setCurrentTab(newValue)
  }

  if (!orgId || !projectId) return null

  return (
    <Page className='tdsk-project-threads-page'>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant='h5'
          component='h1'
        >
          AI Threads
        </Typography>
        <Typography
          variant='body2'
          color='text.secondary'
          sx={{ mt: 1 }}
        >
          Manage AI threads, messages, and generated assets for your project.
        </Typography>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            label='Threads'
            value='threads'
          />
          <Tab
            label='Messages'
            value='messages'
          />
          <Tab
            label='Assets'
            value='assets'
          />
        </Tabs>
      </Paper>

      <Box>
        {currentTab === 'threads' && <ThreadsTab />}
        {currentTab === 'messages' && <MessagesTab />}
        {currentTab === 'assets' && <AssetsTab />}
      </Box>
    </Page>
  )
}

export default ProjectThreads
