import type { TTask, TTaskActionArgs } from '@TSCL/types'

import os from 'os'
import path from 'path'
import { Logger } from '@tdsk/logger'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { taskError } from '@TSCL/utils/tasks/error'

const EgressDir = path.join(os.homedir(), `.config`, `tdsk`, `domain`)
const EgressCertFile = `egress.cert`
const EgressKeyFile = `egress.key`

/**
 * Resolve the cert and key file paths using the fallback chain:
 * 1. CLI args (--cert / --key)
 * 2. Env vars (TDSK_EGRESS_CA_CERT / TDSK_EGRESS_CA_KEY)
 * 3. ~/.config/tdsk/domain/egress.cert and egress.key (load or generate)
 */
const resolveCertPaths = (
  pCert: string | undefined,
  pKey: string | undefined,
  envs: Record<string, string>,
  log: boolean
): { certPath: string; keyPath: string } => {
  const certFromArgs = pCert || envs.TDSK_EGRESS_CA_CERT
  const keyFromArgs = pKey || envs.TDSK_EGRESS_CA_KEY

  if (certFromArgs && keyFromArgs) return { certPath: certFromArgs, keyPath: keyFromArgs }

  const defaultCert = path.join(EgressDir, EgressCertFile)
  const defaultKey = path.join(EgressDir, EgressKeyFile)

  if (existsSync(defaultCert) && existsSync(defaultKey)) {
    log && Logger.pair(`Using existing CA files from`, EgressDir)
    return { certPath: defaultCert, keyPath: defaultKey }
  }

  log && Logger.pair(`Generating new CA cert/key in`, EgressDir)
  generateCA(defaultCert, defaultKey)

  return { certPath: defaultCert, keyPath: defaultKey }
}

const generateCA = (certPath: string, keyPath: string) => {
  mkdirSync(path.dirname(certPath), { recursive: true })

  execFileSync(
    `openssl`,
    [
      `req`,
      `-x509`,
      `-newkey`,
      `rsa:2048`,
      `-keyout`,
      keyPath,
      `-out`,
      certPath,
      `-days`,
      `3650`,
      `-nodes`,
      `-subj`,
      `/CN=TDSK Egress Proxy CA`,
    ],
    { stdio: `pipe` }
  )

  Logger.info(
    [
      `\n`,
      `Generated egress proxy CA certificate\n`,
      ` - Cert: ${Logger.colors.white(certPath)}\n`,
      ` - Key:  ${Logger.colors.white(keyPath)}\n`,
      ` - Valid for 10 years`,
      `\n`,
    ].join(` `)
  )
}

const egressAct = async (props: TTaskActionArgs) => {
  const { params, tasks, config } = props
  const secretTask = tasks?.kube?.tasks?.secret
  !secretTask &&
    taskError(
      `The "kube.tasks.secret" task can not be found. Ensure it exists before running this command`
    )

  const { cert: pCert, key: pKey, ...secParams } = params
  const envs = config.envs

  const { certPath, keyPath } = resolveCertPaths(pCert, pKey, envs, params.log)

  params.log && Logger.pair(`CA cert path`, certPath)
  params.log && Logger.pair(`CA key path`, keyPath)

  if (!secretTask?.action) return taskError(`Secret task could not be loaded!`)

  await secretTask.action({
    ...props,
    params: {
      ...secParams,
      name: envs.TDSK_KUBE_SCRT_EGRESS_CA || `tdsk-egress-ca`,
      files: `tls.crt:${certPath},tls.key:${keyPath}`,
    },
  })
}

export const egress: TTask = {
  name: `egress`,
  action: egressAct,
  alias: [`egress-ca`, `eca`],
  example: `tdsk kube secret egress --cert ./ca.crt --key ./ca.key`,
  description: `Creates a kubernetes secret for the egress proxy CA certificate and key`,
  options: {
    cert: {
      alias: [`crt`],
      env: `TDSK_EGRESS_CA_CERT`,
      example: `--cert /path/to/ca.crt`,
      description: `Path to the CA certificate file. Falls back to ~/.config/tdsk/domain/egress.cert`,
    },
    key: {
      alias: [`ky`],
      env: `TDSK_EGRESS_CA_KEY`,
      example: `--key /path/to/ca.key`,
      description: `Path to the CA private key file. Falls back to ~/.config/tdsk/domain/egress.key`,
    },
    log: {
      default: true,
      type: `boolean`,
      description: `Log the task output`,
    },
  },
}
