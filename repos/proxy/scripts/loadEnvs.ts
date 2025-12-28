import hq from 'alias-hq'
import path from 'node:path'
import { homedir } from 'node:os'
import { addToProcess } from './addToProcess'
import { isStr } from '@keg-hub/jsutils/isStr'
import { limbo } from '@keg-hub/jsutils/limbo'
import { loadConfigs } from '@keg-hub/parse-config'
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  GetSecretValueCommandOutput,
} from '@aws-sdk/client-secrets-manager'

const { NODE_ENV, RAG_REPO_ROOT_DIR, RAG_REPO_DEPLOY_DIR } = process.env
const SecretPrefix = `secrets:`
const nodeEnv = NODE_ENV || `local`

type TOnSecretCB = (
  secrets: Record<string, any>,
  key: string,
  value: string
) => Record<string, any>

export type TLoadEnvs = {
  name?: string
  env?: string
  force?: boolean
  noEnv?: boolean
  secrets?: string[]
  processAdd?: boolean
  locations?: string[]
  onSecret?: TOnSecretCB
}

export type TLoadSecrets = {
  secrets: string[]
  onSecret: TOnSecretCB
  envs: Record<string, any>
}

const loadAWSSecrets = async (args: TLoadSecrets) => {
  const { envs, secrets, onSecret } = args

  const client = new SecretsManagerClient()

  return await Object.entries(envs).reduce(
    async (resolve, [key, value]) => {
      const acc = await resolve

      if (!isStr(value) || !secrets.includes(key) || !value.startsWith(SecretPrefix))
        return acc

      const SecretId = value.split(SecretPrefix).pop()
      const [err, resp] = await limbo<GetSecretValueCommandOutput>(
        client.send(new GetSecretValueCommand({ SecretId }))
      )
      if (!err) return onSecret(acc, key, resp.SecretString)

      if (err?.name === `ExpiredTokenException`) {
        console.error(`[AWS Secrets Manager] ${err.message}\n`)
        process.exit(1)
      }
      throw err
    },
    Promise.resolve({ ...envs })
  )
}

export const loadEnvs = async (args: TLoadEnvs) => {
  const {
    force,
    secrets,
    onSecret,
    processAdd,
    locations = [],
    env = nodeEnv,
    name = `proxy`,
  } = args

  const envs = loadConfigs({
    env,
    name,
    locations: [
      ...locations,
      RAG_REPO_ROOT_DIR || hq.get(`webpack`)[`@ror/root`],
      RAG_REPO_DEPLOY_DIR || hq.get(`webpack`)[`@ror/deploy`],
      path.join(homedir(), `.config/ragorama`),
    ],
  })

  const loaded =
    secrets?.length && onSecret ? await loadAWSSecrets({ envs, secrets, onSecret }) : envs

  /*
   * Load the config files from `<root>/configs` directory, then add to the process.
   */
  processAdd !== false && addToProcess(loaded, force)

  return loaded
}
