import hq from 'alias-hq'
import path from 'node:path'
import { loadEnvs } from '@tdsk/domain'

const aliases = hq.get(`webpack`)
const root: string = aliases[`@ROOT`]
const paths: Record<string, string> = {
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
  TDSK_IMAGE,
  TDSK_IMAGE_TAG,
  TDSK_IMAGE_FROM,
  TDSK_DEV_IMAGE_TAG,
  TDSK_APP_DEPLOYMENT,

  TDSK_PX_PORT,
  TDSK_PX_IMAGE,
  TDSK_PX_DEPLOYMENT,
  TDSK_PX_IMAGE_TAG = TDSK_IMAGE_TAG,
  TDSK_PX_IMAGE_FROM = TDSK_IMAGE_FROM,
  TDSK_PX_DEV_IMAGE_TAG = TDSK_DEV_IMAGE_TAG,

  TDSK_BE_PORT,
  TDSK_BE_IMAGE,
  TDSK_BE_DEPLOYMENT,
  TDSK_BE_IMAGE_TAG = TDSK_IMAGE_TAG,
  TDSK_BE_IMAGE_FROM = TDSK_IMAGE_FROM,
  TDSK_BE_DEV_IMAGE_TAG = TDSK_DEV_IMAGE_TAG,

  TDSK_AD_PORT,
  TDSK_AD_IMAGE,
  TDSK_AD_DEPLOYMENT,
  TDSK_AD_REMOTE_PORT = TDSK_AD_PORT,
  TDSK_AD_IMAGE_TAG = TDSK_IMAGE_TAG,
  TDSK_AD_IMAGE_FROM = TDSK_IMAGE_FROM,
  TDSK_AD_DEV_IMAGE_TAG = TDSK_DEV_IMAGE_TAG,

  TDSK_CADDY_IMAGE,
  TDSK_CADDY_DEPLOYMENT,
  TDSK_CADDY_IMAGE_FROM = `caddy:builder`,
  TDSK_CADDY_IMAGE_TAG = TDSK_IMAGE_TAG,
  TDSK_CADDY_DEV_IMAGE_TAG = TDSK_DEV_IMAGE_TAG,

  TDSK_SB_IMAGE,
  TDSK_SB_IMAGE_TAG = TDSK_IMAGE_TAG,
  TDSK_SB_IMAGE_FROM = `ubuntu:24.04`,
  TDSK_SB_DEV_IMAGE_TAG = TDSK_DEV_IMAGE_TAG,

  TDSK_SB_INIT_IMAGE = `ghcr.io/threadedstack/tdsk-init`,
  TDSK_SB_INIT_IMAGE_TAG = TDSK_IMAGE_TAG,
  TDSK_SB_INIT_IMAGE_FROM = `alpine:3.22`,
  TDSK_SB_INIT_DEV_IMAGE_TAG = TDSK_DEV_IMAGE_TAG,

  TDSK_CADDY_ADMIN_PORT,
  TDSK_CADDY_LOCAL_PORT,
  TDSK_CADDY_SECURE_LOCAL_PORT,
  TDSK_CADDY_REMOTE_PORT = TDSK_CADDY_LOCAL_PORT,
  TDSK_CADDY_SECURE_REMOTE_PORT = TDSK_CADDY_SECURE_LOCAL_PORT,
} = envs

export const config = {
  envs,
  paths,
  release: {
    restart: [`caddy`, `proxy`, `backend`],
    firebase: [`admin`, `threads`, `website`],
    docker: [`caddy`, `proxy`, `backend`, `sandbox`, `init`],
  },
  contexts: {
    app: {
      tags: [],
      location: root,
      image: TDSK_IMAGE,
      tag: TDSK_IMAGE_TAG,
      from: TDSK_IMAGE_FROM,
      dtag: TDSK_DEV_IMAGE_TAG,
      dockerfile: `Dockerfile.app`,
      deployment: TDSK_APP_DEPLOYMENT,
      mounts: {
        [root]: `/tdsk`,
      },
      ports: {
        [TDSK_BE_PORT]: TDSK_BE_PORT,
        [TDSK_PX_PORT]: TDSK_PX_PORT,
      },
    },
    proxy: {
      tags: [],
      image: TDSK_PX_IMAGE,
      tag: TDSK_PX_IMAGE_TAG,
      from: TDSK_PX_IMAGE_FROM,
      dtag: TDSK_PX_DEV_IMAGE_TAG,
      deployment: TDSK_PX_DEPLOYMENT,
      dockerfile: `Dockerfile.proxy`,
      location: path.join(paths.repos, `proxy`),
      mounts: {},
      ports: {
        [TDSK_PX_PORT]: TDSK_PX_PORT,
      },
    },
    backend: {
      tags: [],
      image: TDSK_BE_IMAGE,
      tag: TDSK_BE_IMAGE_TAG,
      from: TDSK_BE_IMAGE_FROM,
      dtag: TDSK_BE_DEV_IMAGE_TAG,
      deployment: TDSK_BE_DEPLOYMENT,
      dockerfile: `Dockerfile.backend`,
      location: path.join(paths.repos, `backend`),
      mounts: {},
      ports: {
        [TDSK_BE_PORT]: TDSK_BE_PORT,
      },
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
      mounts: {},
      ports: {
        [TDSK_AD_PORT]: TDSK_AD_REMOTE_PORT,
      },
    },
    caddy: {
      tags: [],
      image: TDSK_CADDY_IMAGE,
      tag: TDSK_CADDY_IMAGE_TAG,
      from: TDSK_CADDY_IMAGE_FROM,
      dtag: TDSK_CADDY_DEV_IMAGE_TAG,
      deployment: TDSK_CADDY_DEPLOYMENT,
      dockerfile: `Dockerfile.caddy`,
      location: paths.deploy,
      mounts: {},
      ports: {
        [TDSK_CADDY_ADMIN_PORT]: TDSK_CADDY_ADMIN_PORT,
        [TDSK_CADDY_LOCAL_PORT]: TDSK_CADDY_REMOTE_PORT,
        [TDSK_CADDY_SECURE_LOCAL_PORT]: TDSK_CADDY_SECURE_REMOTE_PORT,
      },
    },
    sandbox: {
      tags: [],
      deployment: ``,
      image: TDSK_SB_IMAGE,
      tag: TDSK_SB_IMAGE_TAG,
      location: paths.deploy,
      from: TDSK_SB_IMAGE_FROM,
      dtag: TDSK_SB_DEV_IMAGE_TAG,
      dockerfile: `Dockerfile.sandbox`,
      mounts: {},
      ports: {},
    },
    init: {
      tags: [],
      deployment: ``,
      image: TDSK_SB_INIT_IMAGE,
      tag: TDSK_SB_INIT_IMAGE_TAG,
      location: paths.deploy,
      from: TDSK_SB_INIT_IMAGE_FROM,
      dtag: TDSK_SB_INIT_DEV_IMAGE_TAG,
      dockerfile: `Dockerfile.init`,
      mounts: {},
      ports: {},
    },
  },
}
