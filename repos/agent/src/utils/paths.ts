import hq from 'alias-hq'

const aliases = hq.get(`webpack`)

export const paths = {
  tdsk: aliases[`@ROOT`],
  root: aliases[`@TAG/root`],
  dist: aliases[`@TAG/dist`],
  configs: aliases[`@TAG/configs`],
}
