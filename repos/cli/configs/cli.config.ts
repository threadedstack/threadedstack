import hq from 'alias-hq'
import path from 'node:path'
import { loadEnvs } from '@tdsk/domain'

const aliases = hq.get(`webpack`)
const root = aliases[`@ROOT`]
const paths = {
  root,
  temp: path.join(root, `.temp`),
  repos: path.join(root, `repos`),
  deploy: path.join(root, `deploy`),
  configs: path.join(root, `configs`),
  scripts: path.join(root, `scripts`),
}

const nodeEnv = process.env.NODE_ENV || `local`
const envs = loadEnvs({
  name: `tdsk`,
  override: nodeEnv === `local`,
})


const {
  TDSK_IMAGE_TAG,
  TDSK_IMAGE_FROM,
  TDSK_DEV_IMAGE_TAG,

  TDSK_PX_IMAGE,
  TDSK_PX_DEPLOYMENT,
  TDSK_PX_IMAGE_TAG=TDSK_IMAGE_TAG,
  TDSK_PX_IMAGE_FROM=TDSK_IMAGE_FROM,
  TDSK_PX_DEV_IMAGE_TAG=TDSK_DEV_IMAGE_TAG,

  TDSK_BE_IMAGE,
  TDSK_BE_DEPLOYMENT,
  TDSK_BE_IMAGE_TAG=TDSK_IMAGE_TAG,
  TDSK_BE_IMAGE_FROM=TDSK_IMAGE_FROM,
  TDSK_BE_DEV_IMAGE_TAG=TDSK_DEV_IMAGE_TAG,

  TDSK_AD_IMAGE,
  TDSK_AD_DEPLOYMENT,
  TDSK_AD_IMAGE_TAG=TDSK_IMAGE_TAG,
  TDSK_AD_IMAGE_FROM=TDSK_IMAGE_FROM,
  TDSK_AD_DEV_IMAGE_TAG=TDSK_DEV_IMAGE_TAG,


} = envs


export const config = {
  envs,
  paths,
  contexts: {
    proxy: {
      tags: [],
      image: TDSK_PX_IMAGE,
      tag: TDSK_PX_IMAGE_TAG,
      from: TDSK_PX_IMAGE_FROM,
      dtag: TDSK_PX_DEV_IMAGE_TAG,
      deployment: TDSK_PX_DEPLOYMENT,
      dockerfile: `Dockerfile.proxy`,
      location: path.join(paths.repos, `proxy`),
    },
    api: {
      tags: [],
      image: TDSK_BE_IMAGE,
      tag: TDSK_BE_IMAGE_TAG,
      from: TDSK_BE_IMAGE_FROM,
      dockerfile: `Dockerfile.api`,
      dtag: TDSK_BE_DEV_IMAGE_TAG,
      deployment: TDSK_BE_DEPLOYMENT,
      location: path.join(paths.repos, `api`),
    },
    admin: {
      tags: [],
      image: TDSK_AD_IMAGE,
      tag: TDSK_AD_IMAGE_TAG,
      from: TDSK_AD_IMAGE_FROM,
      dtag: TDSK_AD_DEV_IMAGE_TAG,
      deployment: TDSK_AD_DEPLOYMENT,
      dockerfile: `Dockerfile.admin`,
      location: path.join(paths.repos, `admin`),
    },
  }
}
