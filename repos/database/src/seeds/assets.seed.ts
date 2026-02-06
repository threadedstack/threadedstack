import type { TDBAssetInsert } from '@TDB/types'
import { Asset } from '@tdsk/domain'
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
  new Asset({
    type: `image/png`,
    userId: undefined,
    orgId: OrgIds.acme,
    content: undefined,
    threadId: undefined,
    messageId: undefined,
    projectId: undefined,
    providerId: undefined,
    id: AssetIds.acmeLogo,
    name: `Acme Corporation Logo`,
    url: `https://cdn.acme-corp.com/logo.png`,
    meta: {
      width: 512,
      height: 512,
      size: 45678,
      uploadedBy: UserIds.owner,
    },
  }),
  new Asset({
    orgId: undefined,
    userId: undefined,
    content: undefined,
    threadId: undefined,
    messageId: undefined,
    providerId: undefined,
    type: `image/svg+xml`,
    id: AssetIds.projectDiagram,
    projectId: ProjectIds.acmeApi,
    name: `API Architecture Diagram`,
    url: `https://cdn.acme-corp.com/diagrams/api-arch.svg`,
    meta: {
      size: 12345,
      version: `2.0`,
      category: `documentation`,
    },
  }),
  new Asset({
    orgId: undefined,
    type: `image/jpeg`,
    content: undefined,
    threadId: undefined,
    messageId: undefined,
    projectId: undefined,
    providerId: undefined,
    userId: UserIds.viewer,
    id: AssetIds.userAvatar,
    name: `Profile Picture`,
    url: `https://cdn.example.com/avatars/viewer.jpg`,
    meta: {
      width: 256,
      height: 256,
      size: 23456,
    },
  }),
  new Asset({
    orgId: undefined,
    userId: undefined,
    content: undefined,
    projectId: undefined,
    messageId: undefined,
    providerId: undefined,
    name: `Q1 Budget Spreadsheet`,
    id: AssetIds.threadAttachment,
    type: `application/vnd.ms-excel`,
    threadId: ThreadIds.adminPlanning,
    url: `https://cdn.acme-corp.com/files/q1-budget.xlsx`,
    meta: {
      size: 98765,
      uploadedAt: new Date(`2024-01-05T10:05:00Z`).toISOString(),
    },
  }),
  new Asset({
    orgId: undefined,
    type: `image/png`,
    userId: undefined,
    threadId: undefined,
    projectId: undefined,
    providerId: undefined,
    id: AssetIds.messageImage,
    name: `Dashboard Screenshot`,
    messageId: MessageIds.thread2Msg1,
    url: `https://cdn.acme-corp.com/support/screenshot-123.png`,
    content: undefined,
    meta: {
      width: 1920,
      height: 1080,
      size: 234567,
      timestamp: new Date(`2024-01-15T14:29:50Z`).toISOString(),
    },
  }),
  new Asset({
    url: undefined,
    userId: undefined,
    orgId: OrgIds.acme,
    threadId: undefined,
    projectId: undefined,
    messageId: undefined,
    type: `application/json`,
    id: AssetIds.providerConfig,
    name: `OpenAI Configuration`,
    providerId: ProviderIds.acmeOpenai,
    content: {
      systemPrompt: `You are a helpful AI assistant for Acme Corporation.`,
      modelSettings: {
        topP: 1.0,
        maxTokens: 4096,
        temperature: 0.7,
      },
    },
    meta: {
      version: `1.0`,
      lastUpdated: new Date(`2024-01-10T12:00:00Z`).toISOString(),
    },
  }),
]
