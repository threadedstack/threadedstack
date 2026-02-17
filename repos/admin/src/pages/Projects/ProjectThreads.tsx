import { useState } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { ThreadsTab } from '@TAF/components/AI/ThreadsTab'
import { MessagesTab } from '@TAF/components/AI/MessagesTab'
import type { TAgentThreadTab } from '@TAF/types'
import { EAgentThreadTab } from '@TAF/types'
import { Box, Tab, Tabs, Paper, Typography } from '@mui/material'
import { useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'
import { capitalize } from '@keg-hub/jsutils/capitalize'

export type TProjectThreads = {}

export const ProjectThreads = (props: TProjectThreads) => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [currentTab, setCurrentTab] = useState<TAgentThreadTab>(EAgentThreadTab.threads)

  const handleTabChange = (_event: React.SyntheticEvent, val: TAgentThreadTab) => {
    setCurrentTab(val)
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
          {Object.entries(EAgentThreadTab).map(([key, value]) => {
            /* Assets tab hidden until backend /assets endpoint is implemented (BUG #53) */
            if (value === EAgentThreadTab.assets) return null
            return (
              <Tab
                key={value}
                value={value}
                label={capitalize(key)}
              />
            )
          })}
        </Tabs>
      </Paper>

      <Box>
        {currentTab === EAgentThreadTab.threads && (
          <ThreadsTab onSwitchToMessages={() => setCurrentTab('messages')} />
        )}
        {currentTab === EAgentThreadTab.messages && <MessagesTab />}
        {/* Assets tab hidden until backend /assets endpoint is implemented (BUG #53) */}
      </Box>
    </Page>
  )
}

export default ProjectThreads
