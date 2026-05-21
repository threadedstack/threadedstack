import type {
  OrgIdPrefix,
  RoleIdPrefix,
  AssetIdPrefix,
  AgentIdPrefix,
  SkillIdPrefix,
  QuotaIdPrefix,
  ApiKeyIdPrefix,
  DomainIdPrefix,
  ThreadIdPrefix,
  SecretIdPrefix,
  SandboxIdPrefix,
  InvoiceIdPrefix,
  MessageIdPrefix,
  ProjectIdPrefix,
  EndpointIdPrefix,
  FunctionIdPrefix,
  ProviderIdPrefix,
  ScheduleIdPrefix,
  AgentSkillIdPrefix,
  SandboxSkillIdPrefix,
  InvitationIdPrefix,
  SubscriptionIdPrefix,
  AgentProjectIdPrefix,
  AgentProviderIdPrefix,
  SandboxProjectIdPrefix,
  SandboxProviderIdPrefix,
  ProjectProviderIdPrefix,
  SandboxProjectProviderIdPrefix,
} from '@TDM/constants/prefixes'

export type TEntityPrefix =
  | typeof OrgIdPrefix
  | typeof RoleIdPrefix
  | typeof AssetIdPrefix
  | typeof AgentIdPrefix
  | typeof SkillIdPrefix
  | typeof QuotaIdPrefix
  | typeof ApiKeyIdPrefix
  | typeof DomainIdPrefix
  | typeof ThreadIdPrefix
  | typeof SecretIdPrefix
  | typeof SandboxIdPrefix
  | typeof InvoiceIdPrefix
  | typeof MessageIdPrefix
  | typeof ProjectIdPrefix
  | typeof EndpointIdPrefix
  | typeof FunctionIdPrefix
  | typeof ProviderIdPrefix
  | typeof ScheduleIdPrefix
  | typeof AgentSkillIdPrefix
  | typeof InvitationIdPrefix
  | typeof SandboxSkillIdPrefix
  | typeof SubscriptionIdPrefix
  | typeof AgentProjectIdPrefix
  | typeof AgentProviderIdPrefix
  | typeof SandboxProjectIdPrefix
  | typeof SandboxProviderIdPrefix
  | typeof ProjectProviderIdPrefix
  | typeof SandboxProjectProviderIdPrefix
