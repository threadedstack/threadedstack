/*
 * [General Information](https://commitlint.js.org/)
 * Allowed scopes, must be one of
 * build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test
 *
 * Commit messages should follow the following format
 * <type>[optional scope]: <description>
 * [optional body]
 * [optional footer(s)]
 *
 * [See here for spec](https://www.conventionalcommits.org/en/v1.0.0/)
 *
 * @example - Example of a valid commit message for changes to the components sub-repo
 * fix(components): Added new Text component  -  // Header
 * Add a Text component to normalize displaying text content  -  // Body - can be multiline
 *
 * @example - Example of a valid commit message for changes to the root repo files
 * docs: Updated README.md with more information  -  // Header only
 *
 * @example - Example of a valid commit message for changes to multiple scopes with breaking changes
 * build(repos): Rebuild all sub-repos  -  // Header
 * Rebuilt all sub-repos to prep for deployment  -  // Body - can be multiline
 * BREAKING CHANGE: New builds contain breaking changes  -  // Footer - contains semver breaking change info
 *
 */

const fs = require('fs')
const path = require('path')
const reposDir = path.join(__dirname, `../repos`)
const commitTypes = require('./commitTypes.json')

const getRepos = (location, file) => {
  return fs.readdirSync(location).reduce((acc, repo) => {
    const dir = path.join(location, repo)
    const stats = fs.statSync(dir)
    stats.isDirectory() && fs.existsSync(path.join(dir, file)) && acc.push(repo)

    return acc
  }, [])
}

module.exports = {
  extends: [`@commitlint/config-conventional`],
  // [Rules Reference](https://github.com/conventional-changelog/commitlint/blob/master/docs/reference-rules.md)
  rules: {
    [`scope-enum`]: [
      2,
      `always`,
      [
        ...getRepos(reposDir, `package.json`),
        ...getRepos(reposDir, `pyproject.toml`),
        `deps`,
        `ci`,
        `docs`,
        `release`,
      ],
    ],
    // Ignore casing of commit messages
    [`body-case`]: [0],
    [`scope-case`]: [0],
    [`header-case`]: [0],
    [`subject-case`]: [0],
    // Allow the subject to be empty
    [`scope-empty`]: [0],
    // Ignore header pre/post white space
    [`header-trim`]: [0],
    // Allow commit messages with an empty body, i.e. header only
    [`subject-empty`]: [0],
    [`signed-off-by`]: [0],
    // Allow the commit body to be as long as needed
    [`body-max-line-length`]: [0],
    // Ignore leading blank line warning for body
    [`body-leading-blank`]: [0],
    // Allowed commit message types
    [`type-enum`]: [2, 'always', commitTypes.map((item) => item.type)],
  },
}
