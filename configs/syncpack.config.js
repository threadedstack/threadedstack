// @ts-check

/** @type {import("syncpack").RcFile} */
const syncPackCfg = {
  versionGroups: [
    {
      isIgnored: true,
      packages: ['@tdsk/**'],
      dependencies: ['@tdsk/**'],
      label: 'Workspace packages not updated',
    },
  ],
  source: [`package.json`, `repos/*/package.json`],
}

module.exports = syncPackCfg
