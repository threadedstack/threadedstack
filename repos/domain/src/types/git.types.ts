export enum EGitProvider {
  gitea = `gitea`,
  github = `github`,
  gitlab = `gitlab`,
  custom = `custom`,
  bitbucket = `bitbucket`,
  azureDevops = `azure-devops`,
}

export type TGitBrand = `${EGitProvider}`
