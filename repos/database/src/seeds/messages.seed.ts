import type { TDBMessageInsert } from '@TDB/types'

import { Message } from '@tdsk/domain'
import { ThreadIds, MessageIds } from '@TDB/seeds/ids.seed'

export const messagesSeeds: TDBMessageInsert[] = [
  new Message({
    type: `user`,
    id: MessageIds.thread1Msg1,
    threadId: ThreadIds.adminPlanning,
    content: {
      text: `What are our key objectives for Q1 2024?`,
      timestamp: new Date(`2024-01-05T10:00:00Z`).toISOString(),
    },
    meta: {
      role: `user`,
      modelVersion: null,
    },
  }),
  new Message({
    type: `assistant`,
    id: MessageIds.thread1Msg2,
    threadId: ThreadIds.adminPlanning,
    content: {
      text: `Based on our previous discussions, here are the key Q1 objectives:\n1. Launch new API v2\n2. Expand team by 5 members\n3. Achieve 99.9% uptime SLA\n4. Complete security audit`,
      timestamp: new Date(`2024-01-05T10:00:15Z`).toISOString(),
    },
    meta: {
      role: `assistant`,
      modelVersion: `gpt-4-turbo`,
      tokensUsed: 87,
    },
  }),
  new Message({
    type: `user`,
    id: MessageIds.thread2Msg1,
    threadId: ThreadIds.adminSupport,
    content: {
      text: `Customer reports slow response times on the dashboard`,
      timestamp: new Date(`2024-01-15T14:30:00Z`).toISOString(),
    },
    meta: {
      role: `user`,
      customerId: `cust_abc123`,
    },
  }),
  new Message({
    type: `assistant`,
    id: MessageIds.thread2Msg2,
    threadId: ThreadIds.adminSupport,
    content: {
      text: `I can help investigate. Please check:\n1. Database query performance\n2. CDN cache status\n3. Recent deployments\n4. Server load metrics`,
      timestamp: new Date(`2024-01-15T14:30:20Z`).toISOString(),
    },
    meta: {
      tokensUsed: 56,
      role: `assistant`,
      modelVersion: `claude-3-opus-20240229`,
    },
  }),
  new Message({
    type: `user`,
    id: MessageIds.thread3Msg1,
    threadId: ThreadIds.memberDev,
    content: {
      text: `How do I implement rate limiting for the API endpoints?`,
      timestamp: new Date(`2024-01-20T09:15:00Z`).toISOString(),
    },
    meta: {
      role: `user`,
    },
  }),
  new Message({
    type: `user`,
    id: MessageIds.thread4Msg1,
    threadId: ThreadIds.viewer,
    content: {
      text: `Explain TypeScript generics with examples`,
      timestamp: new Date(`2024-01-22T16:00:00Z`).toISOString(),
    },
    meta: {
      role: `user`,
    },
  }),
]
