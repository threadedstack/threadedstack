import type { TTask } from '@TSCL/types'

import { docker } from '@TSCL/utils/docker/docker'

export const login:TTask = {
  name: `login`,
  alias: [`auth`],
  action: async (args) => await docker.login(args),
  example: `pnpm tdsk dev img build <options>`,
  description: `Calls the image build command`,
  options: {
    registry: {
      alias: [`reg`],
      example: `--registry ghcr.io`,
      description: `Docker Registry url to log into, defaults to DOCKER_REGISTRY env`,
    },
    user: {
      alias: [`usr`],
      example: `--user ****`,
      description: `User name or email used to login to docker`,
    },
    token: {
      alias: [`tok`],
      example: `--token ****`,
      description: `Custom login token for the active git user`,
    },
    envs: {
      type: `object`,
      alias: [`e`],
      example: `CUSTOM_ENV:custom-value,OTHER_ENV:other-value`,
      description: `Key/Value pairs of ENVs to add to the docker process`,
    },
    log: {
      type: `boolean`,
      description: `Log command before they are build`,
    },
  },
}

