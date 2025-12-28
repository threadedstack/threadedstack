import type {
  TTaskActionArgs
} from '@TSCL/types'

const passEnv = (data:Record<string, string>) => {
  const {
    NPM_TOKEN,
    GIT_TOKEN,
    NPM_AUTH_TOKEN,
    DOCKER_PASSWORD,
    DOCKER_AUTH_PASSWORD
  } = data

  return DOCKER_PASSWORD
    || DOCKER_AUTH_PASSWORD
    || GIT_TOKEN
    || NPM_TOKEN
    || NPM_AUTH_TOKEN
}

const userEnv = (data:Record<string, string>) => {
  const {
    NPM_USER,
    GIT_USER,
    NPM_AUTH_USER,
    DOCKER_USER,
    DOCKER_AUTH_USER
  } = data

  return DOCKER_USER
    || DOCKER_AUTH_USER
    || GIT_USER
    || NPM_USER
    || NPM_AUTH_USER
}


export const password = (props:TTaskActionArgs) => {
  if(props?.params?.token) return props?.params?.token
  return passEnv(process.env) || passEnv(props.config.envs)
}

export const user = (props:TTaskActionArgs) => {
  if(props?.params?.user) return props?.params?.user
  return userEnv(process.env) || userEnv(props.config.envs)
}

export const auth = (props:TTaskActionArgs) => {
  const usr = user(props)
  const pass = password(props)

  return {
    user: usr,
    password: pass,
  }
}
