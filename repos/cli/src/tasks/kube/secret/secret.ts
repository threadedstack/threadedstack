import type { TTask, TTaskActionArgs, TTaskParams } from '@TSCL/types'
import os from 'os'
import path from 'path'
import { s3 } from './s3'
import { list } from './list'
import { tdsk } from './tdsk'
import { email } from './email'
import { docker } from './docker'
import { egress } from './egress'
import { payments } from './payments'
import { database } from './database'
import { Logger } from '@tdsk/logger'
import { writeFileSync, rmSync } from 'fs'
import { uuid } from '@keg-hub/jsutils/uuid'
import { kubectl } from '@TSCL/utils/kube/kubectl'
import { taskError } from '@TSCL/utils/tasks/error'
import { resolveLocalPath } from '@TSCL/utils/helpers/resolveLocalPath'

const resolveNames = (name: string, key: string, keyvalue: string) => {
  const splitK = keyvalue && keyvalue.trim().split(`:`).shift()

  if (!key) key = splitK || name
  if (!name) name = key || splitK

  if (!name || !key)
    taskError(`Either the 'name' or 'key' option must be passed to create a secret`)

  return { name, key }
}

const saveTempSecret = (value: string) => {
  const tempDir = os.tmpdir()
  const tempFileLoc = path.join(tempDir, `${uuid()}.txt`)
  writeFileSync(tempFileLoc, value)

  return tempFileLoc
}

type TAddSecretArg = {
  key?: string
  log?: boolean
  args: string[]
  name: string
  files: string[]
  value: string
}

const addSecretArg = ({ key, log, args, name, files, value }: TAddSecretArg) => {
  const loc = saveTempSecret(value)
  if (!loc) return loc

  args.push(key ? `--from-file=${key}=${loc}` : `--from-file=${loc}`)
  files.push(loc)
  log && logCreate(name, key, loc)

  return loc
}

const buildLocs = (params: TTaskParams, name: string, defkey: string) => {
  const { file, log, files, literal, secrets, keyvalue, separator, value: val } = params

  const secretFiles = files ? files.split(`,`) : file ? [`${defkey}:${file}`] : []

  const builtArr = secretFiles.reduce((acc, joined) => {
    const [key, ...rest] = joined.includes(`:`) ? joined.trim().split(`:`) : [``, joined]

    const loc = rest.join(`:`)

    if (!loc) return acc

    key
      ? acc.push(`--from-file=${key}=${resolveLocalPath(loc)}`)
      : acc.push(`--from-file=${resolveLocalPath(loc)}`)

    log && logCreate(name, key, loc)

    return acc
  }, [])

  const secretsFrom = secrets
    ? secrets.split(separator || `,`)
    : keyvalue
      ? [keyvalue]
      : []

  const tempFiles = []
  const secretArgs = secretsFrom.reduce((acc, joined) => {
    const [key, ...val] = joined.trim().split(`:`)
    const value = val.join(`:`)

    value &&
      addSecretArg({
        log,
        key,
        name,
        value,
        args: acc,
        files: tempFiles,
      })

    return acc
  }, builtArr)

  if (val)
    literal
      ? secretArgs.push(`--from-literal=${defkey}=${val}`)
      : addSecretArg({
          log,
          name,
          value: val,
          key: defkey,
          files: tempFiles,
          args: secretArgs,
        })

  return { tempFiles, secretArgs }
}

const logCreate = (name: string, key: string, loc: string) => {
  Logger.info(
    [
      `\n`,
      `Creating Secret: ${Logger.colors.white(name)}\n`,
      key && ` - Key: ${Logger.colors.white(key)}\n`,
      ` - File: ${Logger.colors.white(loc)}`,
      `\n`,
    ]
      .filter(Boolean)
      .join(' ')
  )
}

/**
 * Log the output of a running kubernetes pod
 * @param {Object} args - arguments passed from the runTask method
 * @param {string} args.command - Root task name
 * @param {Object} args.tasks - All registered tasks of the CLI
 * @param {string} args.task - Task Definition of the task being run
 * @param {Array} args.options - arguments passed from the command line
 * @param {Object} args.globalConfig - Global config object for the keg-cli
 * @param {Object} args.params - Passed in options, converted into an object
 *
 * @returns {void}
 */
const secretAct = async (props: TTaskActionArgs) => {
  const { params } = props
  const { file, files, value, secrets, keyvalue, namespace, type = `generic` } = params

  !value &&
    !keyvalue &&
    !secrets &&
    !file &&
    !files &&
    taskError(
      `One of 'value', 'keyvalue', 'secrets', 'file', or 'files' must be passed to create a secret`
    )

  const { name, key } = resolveNames(params.name, params.key, keyvalue)

  const { tempFiles, secretArgs } = buildLocs(params, name, key)
  namespace && secretArgs.push(`--namespace`, namespace)

  const deleteArgs = [`secret`, name]
  namespace && deleteArgs.push(`--namespace`, namespace)
  deleteArgs.push(`--ignore-not-found`)

  await kubectl.delete(props, deleteArgs)
  await kubectl.create(props, [`secret`, type, name, ...secretArgs])

  tempFiles.forEach((loc) => rmSync(loc))
}

export const secret: TTask = {
  name: `secret`,
  alias: [`secrets`, `scrt`, `sct`, `sec`, `sc`],
  action: secretAct,
  example: `tdsk kube secret <options>`,
  description: `Calls the kubectl create secret command`,
  tasks: {
    list,
    s3,
    tdsk,
    email,
    docker,
    egress,
    payments,
    database,
  },
  options: {
    name: {
      alias: [`nm`],
      example: `--name my-secret`,
      description: `Name of the secret, uses key when name is not set`,
    },
    namespace: {
      alias: [`nsp`, `ns`],
      example: `--namespace my-namespace`,
      description: `Namespace to use when creating the secret`,
    },
    context: {
      alias: [`kube-context`, `kc`, `ctx`],
      example: `--context my-context`,
      env: `TDSK_KUBE_CONTEXT`,
      description: `Kubernetes context to use when creating the secret`,
    },
    keyvalue: {
      alias: [`kv`],
      example: `--keyvalue key1:value1`,
      description: `Joined key value pair. Overrides key and value option`,
    },
    secrets: {
      alias: [`data`],
      example: `--secrets key1:value1,key2:value2`,
      description: `Key value pairs for setting multiple secrets separated by comma. Overrides keyvalue and key and value options`,
    },
    key: {
      alias: [`ky`],
      example: `--key secrets-key-name`,
      description: `Key name of the secret, uses name when key is not already set`,
    },
    value: {
      alias: [`val`],
      example: `--value secrets-value`,
      description: `Value of the secret when the file option is not set`,
    },
    file: {
      alias: [`fl`],
      example: `--file /relative/path/to/secret/file`,
      description: `Path to a file that contains the secret relative to the apps root directory`,
    },
    files: {
      alias: [`fls`],
      example: `--files key1:/relative/path/to/secret/file1,key2:/relative/path/to/secret/file2`,
      description: `Key value pairs for setting multiple secrets from files separated by comma. Overrides all other options`,
    },
    type: {
      description: `Type of kubernetes secret to create`,
    },
    literal: {
      alias: [`lit`],
      type: `boolean`,
      example: `--literal`,
      description: `Create the kubernetes secret from a literal value`,
    },
    separator: {
      alias: [`sep`],
      example: `--separator "||"`,
      description: `Delimiter used to split the secrets string (default: comma)`,
    },
    log: {
      type: `boolean`,
      default: true,
      description: `Log the commands to be run`,
    },
  },
}
