import type { TDBAssetInsert } from '@TDB/types'
import { OrgIds } from '@TDB/seeds/orgs.seed'
import { UserIds } from '@TDB/seeds/users.seed'
import { ThreadIds } from '@TDB/seeds/threads.seed'
import { ProjectIds } from '@TDB/seeds/projects.seed'
import { MessageIds } from '@TDB/seeds/messages.seed'
import { ProviderIds } from '@TDB/seeds/providers.seed'

/**
 * Assets Seed Data
 * Exclusive Arc: orgId OR projectId OR userId OR threadId OR messageId (exactly one)
 */

export const AssetIds = {
  acmeLogo: `e0000000-0000-0000-0000-000000000001`,
  projectDiagram: `e0000000-0000-0000-0000-000000000002`,
  userAvatar: `e0000000-0000-0000-0000-000000000003`,
  threadAttachment: `e0000000-0000-0000-0000-000000000004`,
  messageImage: `e0000000-0000-0000-0000-000000000005`,
  providerConfig: `e0000000-0000-0000-0000-000000000006`,
} as const

export const assetsSeeds: TDBAssetInsert[] = [
  {
    id: AssetIds.acmeLogo,
    orgId: OrgIds.acme,
    projectId: null,
    userId: null,
    threadId: null,
    messageId: null,
    providerId: null,
    name: `Acme Corporation Logo`,
    type: `image/png`,
    url: `https://cdn.acme-corp.com/logo.png`,
    content: null,
    meta: {
      size: 45678,
      width: 512,
      height: 512,
      uploadedBy: UserIds.owner,
    },
  },
  {
    id: AssetIds.projectDiagram,
    orgId: null,
    projectId: ProjectIds.acmeApi,
    userId: null,
    threadId: null,
    messageId: null,
    providerId: null,
    name: `API Architecture Diagram`,
    type: `image/svg+xml`,
    url: `https://cdn.acme-corp.com/diagrams/api-arch.svg`,
    content: null,
    meta: {
      size: 12345,
      category: `documentation`,
      version: `2.0`,
    },
  },
  {
    id: AssetIds.userAvatar,
    orgId: null,
    projectId: null,
    userId: UserIds.viewer,
    threadId: null,
    messageId: null,
    providerId: null,
    name: `Profile Picture`,
    type: `image/jpeg`,
    url: `https://cdn.example.com/avatars/viewer.jpg`,
    content: null,
    meta: {
      size: 23456,
      width: 256,
      height: 256,
    },
  },
  {
    id: AssetIds.threadAttachment,
    orgId: null,
    projectId: null,
    userId: null,
    threadId: ThreadIds.adminPlanning,
    messageId: null,
    providerId: null,
    name: `Q1 Budget Spreadsheet`,
    type: `application/vnd.ms-excel`,
    url: `https://cdn.acme-corp.com/files/q1-budget.xlsx`,
    content: null,
    meta: {
      size: 98765,
      uploadedAt: new Date(`2024-01-05T10:05:00Z`).toISOString(),
    },
  },
  {
    id: AssetIds.messageImage,
    orgId: null,
    projectId: null,
    userId: null,
    threadId: null,
    messageId: MessageIds.thread2Msg1,
    providerId: null,
    name: `Dashboard Screenshot`,
    type: `image/png`,
    url: `https://cdn.acme-corp.com/support/screenshot-123.png`,
    content: null,
    meta: {
      size: 234567,
      width: 1920,
      height: 1080,
      timestamp: new Date(`2024-01-15T14:29:50Z`).toISOString(),
    },
  },
  {
    id: AssetIds.providerConfig,
    orgId: null,
    projectId: null,
    userId: null,
    threadId: null,
    messageId: null,
    providerId: ProviderIds.acmeOpenai,
    name: `OpenAI Configuration`,
    type: `application/json`,
    url: null,
    content: {
      modelSettings: {
        temperature: 0.7,
        maxTokens: 4096,
        topP: 1.0,
      },
      systemPrompt: `You are a helpful AI assistant for Acme Corporation.`,
    },
    meta: {
      version: `1.0`,
      lastUpdated: new Date(`2024-01-10T12:00:00Z`).toISOString(),
    },
  },
]
