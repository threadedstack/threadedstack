import type { TGitFsAdapter, TGitCmdResult } from '@TSB/types'

import git from 'isomorphic-git'
import { defineCommand } from 'just-bash'
import http from 'isomorphic-git/http/node'
import { createGitFsAdapter } from '@TSB/git/fsAdapter'

const ok = (stdout = ``): TGitCmdResult => ({ stdout, stderr: ``, exitCode: 0 })
const fail = (stderr: string): TGitCmdResult => ({
  stdout: ``,
  stderr,
  exitCode: 1,
})

/**
 * Virtual git command for the just-bash sandbox.
 * Uses isomorphic-git for pure-JS git operations against the in-memory filesystem.
 * Network commands (clone/fetch/pull/push) use isomorphic-git/http/node.
 */
export const gitCommand = defineCommand(`git`, async (args, ctx) => {
  const fs = createGitFsAdapter(ctx.fs)
  const dir = ctx.cwd
  const sub = args[0]

  try {
    switch (sub) {
      case `init`:
        return await onInit(fs, dir, args.slice(1))
      case `add`:
        return await onAdd(fs, dir, args.slice(1))
      case `commit`:
        return await onCommit(fs, dir, args.slice(1), ctx.env)
      case `status`:
        return await onStatus(fs, dir)
      case `log`:
        return await onLog(fs, dir, args.slice(1))
      case `branch`:
        return await onBranch(fs, dir, args.slice(1))
      case `checkout`:
        return await onCheckout(fs, dir, args.slice(1))
      case `merge`:
        return await onMerge(fs, dir, args.slice(1), ctx.env)
      case `diff`:
        return await onDiff(fs, dir)
      case `rev-parse`:
        return await onRevParse(fs, dir, args.slice(1))
      case `switch`:
        return await onSwitch(fs, dir, args.slice(1))
      case `tag`:
        return await onTag(fs, dir, args.slice(1), ctx.env)
      case `remote`:
        return await onRemote(fs, dir, args.slice(1))
      case `reset`:
        return await onReset(fs, dir, args.slice(1))
      case `rm`:
        return await onRm(fs, dir, args.slice(1))
      case `show`:
        return await onShow(fs, dir, args.slice(1))
      case `cherry-pick`:
        return await onCherryPick(fs, dir, args.slice(1), ctx.env)
      case `stash`:
        return await onStash(fs, dir, args.slice(1), ctx.env)
      case `clone`:
        return await onClone(fs, dir, args.slice(1))
      case `fetch`:
        return await onFetch(fs, dir, args.slice(1))
      case `pull`:
        return await onPull(fs, dir, args.slice(1), ctx.env)
      case `push`:
        return await onPush(fs, dir, args.slice(1))
      default:
        return fail(
          sub ? `git: '${sub}' is not a git command` : `usage: git <command> [<args>]`
        )
    }
  } catch (err: any) {
    const code = err?.code ? `[${err.code}] ` : ``
    if (!err?.code) console.error(`[gitCommand] unexpected error:`, err)
    return fail(`${code}${err?.message || String(err)}`)
  }
})

const getAuthor = (env: Record<string, string>) => ({
  name: env.GIT_AUTHOR_NAME || env.GIT_COMMITTER_NAME || `Agent`,
  email: env.GIT_AUTHOR_EMAIL || env.GIT_COMMITTER_EMAIL || `agent@tdsk.app`,
})

async function currentBranch(fs: TGitFsAdapter, dir: string): Promise<string> {
  return (await git.currentBranch({ fs, dir })) || `HEAD`
}

// -- Subcommand Handlers --

async function onInit(
  fs: TGitFsAdapter,
  dir: string,
  args: string[]
): Promise<TGitCmdResult> {
  let defaultBranch = `main`
  const bIdx = args.indexOf(`-b`)
  const ibIdx = args.indexOf(`--initial-branch`)

  if (bIdx !== -1 && args[bIdx + 1]) defaultBranch = args[bIdx + 1]
  else if (ibIdx !== -1 && args[ibIdx + 1]) defaultBranch = args[ibIdx + 1]

  await git.init({ fs, dir, defaultBranch })
  return ok(`Initialized empty Git repository in ${dir}/.git/\n`)
}

async function onAdd(
  fs: TGitFsAdapter,
  dir: string,
  args: string[]
): Promise<TGitCmdResult> {
  const all = args.includes(`-A`) || args.includes(`--all`)
  const filepath = args.find((a) => !a.startsWith(`-`))

  if (all || filepath === `.`) {
    const matrix = await git.statusMatrix({ fs, dir })
    for (const [file, head, workdir, stage] of matrix) {
      if (head === 1 && workdir === 1 && stage === 1) continue
      if (workdir === 0) await git.remove({ fs, dir, filepath: file })
      else if (stage !== 2) await git.add({ fs, dir, filepath: file })
    }
    return ok()
  }

  if (!filepath) return fail(`Nothing specified, nothing added.`)
  await git.add({ fs, dir, filepath })
  return ok()
}

async function onCommit(
  fs: TGitFsAdapter,
  dir: string,
  args: string[],
  env: Record<string, string>
): Promise<TGitCmdResult> {
  const mIdx = args.indexOf(`-m`)
  if (mIdx === -1 || !args[mIdx + 1]) return fail(`error: switch 'm' requires a value`)

  const message = args[mIdx + 1]
  const author = getAuthor(env)
  const sha = await git.commit({ fs, dir, message, author })
  const branch = await currentBranch(fs, dir)

  return ok(`[${branch} ${sha.slice(0, 7)}] ${message}\n`)
}

async function onStatus(fs: TGitFsAdapter, dir: string): Promise<TGitCmdResult> {
  const branch = await currentBranch(fs, dir)
  const matrix = await git.statusMatrix({ fs, dir })
  const lines: string[] = [`On branch ${branch}`, ``]
  const staged: string[] = []
  const unstaged: string[] = []
  const untracked: string[] = []

  // statusMatrix columns: [filepath, HEAD, WORKDIR, STAGE]
  // HEAD:    0=absent, 1=present
  // WORKDIR: 0=absent, 1=same as HEAD, 2=different from HEAD
  // STAGE:   0=absent, 1=same as HEAD, 2=same as WORKDIR, 3=different from WORKDIR
  for (const [file, head, workdir, stage] of matrix) {
    if (head === 1 && workdir === 1 && stage === 1) continue

    // Untracked: exists in workdir but not in HEAD or index
    if (head === 0 && stage === 0) {
      if (workdir === 2) untracked.push(file)
      continue
    }

    // Staged changes: index differs from HEAD
    // stage=2|3 with head=0 → new file; stage=2|3 with head=1 → modified; stage=0 with head=1 → deleted
    if (stage === 2 || stage === 3) {
      staged.push(head === 0 ? `new file:   ${file}` : `modified:   ${file}`)
    } else if (stage === 0 && head === 1) {
      staged.push(`deleted:    ${file}`)
    }

    // Unstaged changes: workdir differs from index
    // stage=2 means workdir matches index → no unstaged change
    if (stage === 1) {
      if (workdir === 2) unstaged.push(`modified:   ${file}`)
      else if (workdir === 0) unstaged.push(`deleted:    ${file}`)
    } else if (stage === 3) {
      if (workdir === 0) unstaged.push(`deleted:    ${file}`)
      else unstaged.push(`modified:   ${file}`)
    }
  }

  if (staged.length) {
    lines.push(`Changes to be committed:`)
    for (const s of staged) lines.push(`\t${s}`)
    lines.push(``)
  }

  if (unstaged.length) {
    lines.push(`Changes not staged for commit:`)
    for (const u of unstaged) lines.push(`\t${u}`)
    lines.push(``)
  }

  if (untracked.length) {
    lines.push(`Untracked files:`)
    for (const u of untracked) lines.push(`\t${u}`)
    lines.push(``)
  }

  if (!staged.length && !unstaged.length && !untracked.length) {
    lines.push(`nothing to commit, working tree clean`)
  }

  return ok(lines.join(`\n`) + `\n`)
}

async function onLog(
  fs: TGitFsAdapter,
  dir: string,
  args: string[]
): Promise<TGitCmdResult> {
  const oneline = args.includes(`--oneline`)
  let depth: number | undefined
  const nIdx = args.indexOf(`-n`)
  if (nIdx !== -1 && args[nIdx + 1]) depth = Number.parseInt(args[nIdx + 1], 10)

  const commits = await git.log({ fs, dir, depth })
  if (!commits.length) return ok()

  const lines: string[] = []
  for (const entry of commits) {
    if (oneline) {
      lines.push(`${entry.oid.slice(0, 7)} ${entry.commit.message.split(`\n`)[0]}`)
    } else {
      lines.push(`commit ${entry.oid}`)
      lines.push(`Author: ${entry.commit.author.name} <${entry.commit.author.email}>`)
      lines.push(
        `Date:   ${new Date(entry.commit.author.timestamp * 1000).toUTCString()}`
      )
      lines.push(``)
      lines.push(`    ${entry.commit.message}`)
      lines.push(``)
    }
  }

  return ok(lines.join(`\n`))
}

async function onBranch(
  fs: TGitFsAdapter,
  dir: string,
  args: string[]
): Promise<TGitCmdResult> {
  if (args.length === 0) {
    const branches = await git.listBranches({ fs, dir })
    const current = await currentBranch(fs, dir)
    const lines = branches.map((b) => (b === current ? `* ${b}` : `  ${b}`))
    return ok(lines.join(`\n`) + `\n`)
  }

  const dIdx = args.indexOf(`-d`)
  const DIdx = args.indexOf(`-D`)
  const deleteIdx = dIdx !== -1 ? dIdx : DIdx

  if (deleteIdx !== -1) {
    const name = args[deleteIdx + 1]
    if (!name) return fail(`error: branch name required`)
    await git.deleteBranch({ fs, dir, ref: name })
    return ok(`Deleted branch ${name}\n`)
  }

  const name = args[0]
  await git.branch({ fs, dir, ref: name })
  return ok()
}

async function onCheckout(
  fs: TGitFsAdapter,
  dir: string,
  args: string[]
): Promise<TGitCmdResult> {
  const bIdx = args.indexOf(`-b`)

  if (bIdx !== -1) {
    const name = args[bIdx + 1]
    if (!name) return fail(`error: switch 'b' requires a value`)
    await git.branch({ fs, dir, ref: name })
    await git.checkout({ fs, dir, ref: name })
    return ok(`Switched to a new branch '${name}'\n`)
  }

  const ref = args[0]
  if (!ref) return fail(`error: you must specify a branch to checkout`)
  await git.checkout({ fs, dir, ref })
  return ok(`Switched to branch '${ref}'\n`)
}

async function onMerge(
  fs: TGitFsAdapter,
  dir: string,
  args: string[],
  env: Record<string, string>
): Promise<TGitCmdResult> {
  const theirs = args[0]
  if (!theirs) return fail(`error: you must specify a branch to merge`)

  const author = getAuthor(env)
  const result = await git.merge({ fs, dir, theirs, author })

  if (result.alreadyMerged) return ok(`Already up to date.\n`)
  if (result.fastForward) return ok(`Fast-forward\n`)
  return ok(`Merge made by the 'recursive' strategy.\n`)
}

async function onDiff(fs: TGitFsAdapter, dir: string): Promise<TGitCmdResult> {
  const matrix = await git.statusMatrix({ fs, dir })
  const lines: string[] = []

  // git diff shows workdir-vs-index changes (unstaged only)
  // stage=2 means workdir matches index → no diff
  for (const [file, head, workdir, stage] of matrix) {
    if (head === 1 && workdir === 1 && stage === 1) continue

    if (stage === 1) {
      if (workdir === 2) lines.push(`modified: ${file}`)
      else if (workdir === 0) lines.push(`deleted:  ${file}`)
    } else if (stage === 3) {
      if (workdir === 0) lines.push(`deleted:  ${file}`)
      else lines.push(`modified: ${file}`)
    }
  }

  return ok(lines.length ? lines.join(`\n`) + `\n` : ``)
}

async function onRevParse(
  fs: TGitFsAdapter,
  dir: string,
  args: string[]
): Promise<TGitCmdResult> {
  if (args.includes(`--abbrev-ref`) && args.includes(`HEAD`)) {
    const branch = await currentBranch(fs, dir)
    return ok(`${branch}\n`)
  }

  if (args.includes(`HEAD`)) {
    const commits = await git.log({ fs, dir, depth: 1 })
    if (commits.length) return ok(`${commits[0].oid}\n`)
    return fail(`fatal: bad default revision 'HEAD'`)
  }

  return fail(`error: unknown rev-parse option`)
}

async function onSwitch(
  fs: TGitFsAdapter,
  dir: string,
  args: string[]
): Promise<TGitCmdResult> {
  const cIdx = args.indexOf(`-c`)
  if (cIdx !== -1) {
    const name = args[cIdx + 1]
    if (!name) return fail(`error: switch 'c' requires a value`)
    await git.branch({ fs, dir, ref: name })
    await git.checkout({ fs, dir, ref: name })
    return ok(`Switched to a new branch '${name}'\n`)
  }

  const ref = args.find((a) => !a.startsWith(`-`))
  if (!ref) return fail(`error: you must specify a branch to switch to`)

  const branches = await git.listBranches({ fs, dir })
  if (!branches.includes(ref)) return fail(`fatal: invalid reference: ${ref}`)

  await git.checkout({ fs, dir, ref })
  return ok(`Switched to branch '${ref}'\n`)
}

async function onTag(
  fs: TGitFsAdapter,
  dir: string,
  args: string[],
  env: Record<string, string>
): Promise<TGitCmdResult> {
  if (args.length === 0) {
    const tags = await git.listTags({ fs, dir })
    return ok(tags.length ? tags.join(`\n`) + `\n` : ``)
  }

  const dIdx = args.indexOf(`-d`)
  if (dIdx !== -1) {
    const name = args[dIdx + 1]
    if (!name) return fail(`error: tag name required`)
    await git.deleteTag({ fs, dir, ref: name })
    return ok(`Deleted tag '${name}'\n`)
  }

  const aIdx = args.indexOf(`-a`)
  if (aIdx !== -1) {
    const name = args[aIdx + 1]
    if (!name) return fail(`error: tag name required`)
    const mIdx = args.indexOf(`-m`)
    const message = mIdx !== -1 && args[mIdx + 1] ? args[mIdx + 1] : ``
    const tagger = getAuthor(env)
    await git.annotatedTag({ fs, dir, ref: name, message, tagger })
    return ok()
  }

  const name = args[0]
  await git.tag({ fs, dir, ref: name })
  return ok()
}

async function onRemote(
  fs: TGitFsAdapter,
  dir: string,
  args: string[]
): Promise<TGitCmdResult> {
  const sub = args[0]

  if (sub === `add`) {
    const name = args[1]
    const url = args[2]
    if (!name || !url) return fail(`usage: git remote add <name> <url>`)
    await git.addRemote({ fs, dir, remote: name, url })
    return ok()
  }

  if (sub === `remove` || sub === `rm`) {
    const name = args[1]
    if (!name) return fail(`usage: git remote remove <name>`)
    await git.deleteRemote({ fs, dir, remote: name })
    return ok()
  }

  const verbose = args.includes(`-v`) || args.includes(`--verbose`)
  const remotes = await git.listRemotes({ fs, dir })
  if (!remotes.length) return ok(``)

  const lines = remotes.map((r) => (verbose ? `${r.remote}\t${r.url}` : r.remote))
  return ok(lines.join(`\n`) + `\n`)
}

async function onReset(
  fs: TGitFsAdapter,
  dir: string,
  args: string[]
): Promise<TGitCmdResult> {
  const filepath = args.find((a) => !a.startsWith(`-`))

  if (filepath) {
    await git.resetIndex({ fs, dir, filepath })
    return ok()
  }

  const matrix = await git.statusMatrix({ fs, dir })
  for (const [file, head, , stage] of matrix) {
    if (head === 1 && stage === 1) continue
    if (head === 0 && stage === 0) continue
    if (stage !== 1) await git.resetIndex({ fs, dir, filepath: file })
  }
  return ok()
}

async function onRm(
  fs: TGitFsAdapter,
  dir: string,
  args: string[]
): Promise<TGitCmdResult> {
  const cached = args.includes(`--cached`)
  const filepath = args.find((a) => !a.startsWith(`-`))
  if (!filepath) return fail(`usage: git rm [--cached] <file>`)

  await git.remove({ fs, dir, filepath })

  if (!cached) {
    const fullPath = dir.endsWith(`/`) ? `${dir}${filepath}` : `${dir}/${filepath}`
    try {
      await fs.promises.unlink(fullPath)
    } catch (err: any) {
      if (err?.code !== `ENOENT`) throw err
    }
  }

  return ok(`rm '${filepath}'\n`)
}

async function onShow(
  fs: TGitFsAdapter,
  dir: string,
  args: string[]
): Promise<TGitCmdResult> {
  const ref = args[0] || `HEAD`
  const oid = await git.resolveRef({ fs, dir, ref })
  const { commit } = await git.readCommit({ fs, dir, oid })

  const lines = [
    `commit ${oid}`,
    `Author: ${commit.author.name} <${commit.author.email}>`,
    `Date:   ${new Date(commit.author.timestamp * 1000).toUTCString()}`,
    ``,
    `    ${commit.message}`,
    ``,
  ]

  return ok(lines.join(`\n`))
}

async function onCherryPick(
  fs: TGitFsAdapter,
  dir: string,
  args: string[],
  env: Record<string, string>
): Promise<TGitCmdResult> {
  const oid = args[0]
  if (!oid) return fail(`error: you must specify a commit to cherry-pick`)

  const committer = getAuthor(env)
  await git.cherryPick({ fs, dir, oid, committer })
  return ok()
}

async function ensureGitConfig(
  fs: TGitFsAdapter,
  dir: string,
  env: Record<string, string>
) {
  const author = getAuthor(env)
  await git.setConfig({ fs, dir, path: `user.name`, value: author.name })
  await git.setConfig({ fs, dir, path: `user.email`, value: author.email })
}

async function onStash(
  fs: TGitFsAdapter,
  dir: string,
  args: string[],
  env: Record<string, string>
): Promise<TGitCmdResult> {
  const sub = args[0]

  if (!sub || sub === `push`) {
    await ensureGitConfig(fs, dir, env)
    const mIdx = args.indexOf(`-m`)
    const message = mIdx !== -1 && args[mIdx + 1] ? args[mIdx + 1] : undefined
    await git.stash({ fs, dir, op: `push`, message })
    return ok(`Saved working directory\n`)
  }

  if (sub === `pop` || sub === `apply` || sub === `drop`) {
    const refIdx = args[1] ? Number.parseInt(args[1], 10) : undefined
    await git.stash({ fs, dir, op: sub, refIdx })
    return ok()
  }

  if (sub === `list`) {
    const result = await git.stash({ fs, dir, op: `list` })
    if (!result) return ok(``)
    return ok(typeof result === `string` ? result : String(result))
  }

  if (sub === `clear`) {
    await git.stash({ fs, dir, op: `clear` })
    return ok()
  }

  return fail(`error: unknown stash subcommand '${sub}'`)
}

async function onClone(
  fs: TGitFsAdapter,
  dir: string,
  args: string[]
): Promise<TGitCmdResult> {
  const positional = args.filter((a) => !a.startsWith(`-`))
  const url = positional[0]
  if (!url) return fail(`fatal: You must specify a repository to clone.`)

  const targetDir = positional[1] || dir

  const depthIdx = args.indexOf(`--depth`)
  const depth =
    depthIdx !== -1 && args[depthIdx + 1]
      ? Number.parseInt(args[depthIdx + 1], 10)
      : undefined

  const branchIdx = args.indexOf(`--branch`)
  const ref = branchIdx !== -1 && args[branchIdx + 1] ? args[branchIdx + 1] : undefined

  const singleBranch = args.includes(`--single-branch`)

  await git.clone({ fs, http, dir: targetDir, url, ref, depth, singleBranch })
  return ok(`Cloning into '${targetDir}'...\n`)
}

async function onFetch(
  fs: TGitFsAdapter,
  dir: string,
  args: string[]
): Promise<TGitCmdResult> {
  const remote = args.find((a) => !a.startsWith(`-`))
  if (!remote) return fail(`fatal: No remote repository specified.`)

  const depthIdx = args.indexOf(`--depth`)
  const depth =
    depthIdx !== -1 && args[depthIdx + 1]
      ? Number.parseInt(args[depthIdx + 1], 10)
      : undefined

  const prune = args.includes(`--prune`)

  await git.fetch({ fs, http, dir, remote, depth, prune })
  return ok()
}

async function onPull(
  fs: TGitFsAdapter,
  dir: string,
  args: string[],
  env: Record<string, string>
): Promise<TGitCmdResult> {
  const remote = args.find((a) => !a.startsWith(`-`))
  if (!remote) return fail(`fatal: No remote repository specified.`)

  const fastForwardOnly = args.includes(`--ff-only`)
  const author = getAuthor(env)

  await git.pull({ fs, http, dir, remote, fastForwardOnly, author })
  return ok()
}

async function onPush(
  fs: TGitFsAdapter,
  dir: string,
  args: string[]
): Promise<TGitCmdResult> {
  const force = args.includes(`-f`) || args.includes(`--force`)
  const positional = args.filter((a) => !a.startsWith(`-`))

  const remote = positional[0]
  if (!remote) return fail(`fatal: No remote repository specified.`)
  const ref = positional[1]

  await git.push({ fs, http, dir, remote, ref, force })
  return ok()
}
