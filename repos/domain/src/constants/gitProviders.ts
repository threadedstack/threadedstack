import type { TGitProviderTemplate } from '@TDM/types'

import { EGitProvider } from '@TDM/types'

export const GitProviderTemplates: Record<EGitProvider, TGitProviderTemplate> = {
  [EGitProvider.github]: {
    id: EGitProvider.github,
    name: `GitHub`,
    gitDomain: `github.com`,
    apiUrlBase: `https://api.github.com`,
    defaultSecretName: `GITHUB_TOKEN`,
    tokenPlaceholder: `ghp_...`,
    tokenPattern: `^(ghp_|github_pat_)`,
  },
  [EGitProvider.gitlab]: {
    id: EGitProvider.gitlab,
    name: `GitLab`,
    gitDomain: `gitlab.com`,
    apiUrlBase: `https://gitlab.com/api/v4`,
    defaultSecretName: `GITLAB_TOKEN`,
    tokenPlaceholder: `glpat-...`,
    tokenPattern: `^glpat-`,
  },
  [EGitProvider.bitbucket]: {
    id: EGitProvider.bitbucket,
    name: `Bitbucket`,
    gitDomain: `bitbucket.org`,
    apiUrlBase: `https://api.bitbucket.org/2.0`,
    defaultSecretName: `BITBUCKET_TOKEN`,
    tokenPlaceholder: `Enter Bitbucket app password...`,
  },
  [EGitProvider.azureDevops]: {
    id: EGitProvider.azureDevops,
    name: `Azure DevOps`,
    gitDomain: `dev.azure.com`,
    apiUrlBase: `https://dev.azure.com`,
    defaultSecretName: `AZURE_DEVOPS_TOKEN`,
    tokenPlaceholder: `Enter Azure DevOps PAT...`,
  },
  [EGitProvider.gitea]: {
    id: EGitProvider.gitea,
    name: `Gitea`,
    gitDomain: ``,
    apiUrlBase: ``,
    defaultSecretName: `GITEA_TOKEN`,
    tokenPlaceholder: `Enter Gitea access token...`,
  },
  [EGitProvider.custom]: {
    id: EGitProvider.custom,
    name: `Custom`,
    gitDomain: ``,
    apiUrlBase: ``,
    defaultSecretName: `CUSTOM_GIT_TOKEN`,
    tokenPlaceholder: `Enter access token...`,
  },
}
