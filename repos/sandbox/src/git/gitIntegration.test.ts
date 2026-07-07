import { describe, it, expect, beforeEach } from 'vitest'
import { Bash, InMemoryFs } from 'just-bash'
import { LocalSandbox, LocalSandboxProvider } from '../local'
import { gitCommand } from './index'
import { ESandboxType } from '@tdsk/domain'
import type { ISandbox } from '@tdsk/domain'

/**
 * End-to-end integration tests for the git toolchain.
 * Zero mocks — exercises the real chain:
 *   LocalSandboxProvider.create() → sandbox.exec("git ...") → Bash → gitCommand → isomorphic-git → InMemoryFs
 */

/** Create a sandbox manually (same pattern as local.test.ts integration tests) */
const createSandbox = async (envVars: Record<string, string> = {}) => {
  const fs = new InMemoryFs()
  await fs.mkdir(`/workspace`, { recursive: true })

  const bash = new Bash({
    fs,
    cwd: `/workspace`,
    env: envVars,
    customCommands: [gitCommand],
  })

  return new LocalSandbox(bash, fs, null)
}

/** Init a repo with a seed commit, returns the sandbox ready for further ops */
const initRepo = async (sandbox: ISandbox, branch = `main`) => {
  const branchArgs = branch !== `main` ? ` -b ${branch}` : ``
  await sandbox.exec(`git init${branchArgs}`)
  await sandbox.writeFile(`/workspace/seed.txt`, `seed content`)
  await sandbox.exec(`git add .`)
  await sandbox.exec(`git commit -m "seed commit"`)
  return sandbox
}

// ─── 1. Provider-Based Creation ───────────────────────────────────────────

describe(`Provider-Based Creation`, () => {
  it(`should create via provider and run git init`, async () => {
    const provider = new LocalSandboxProvider()
    const sandbox = await provider.create({ provider: ESandboxType.local, envVars: {} })

    const result = await sandbox.exec(`git init`)
    expect(result.success).toBe(true)
    expect(result.output).toContain(`Initialized empty Git repository`)

    await sandbox.close()
  })

  it(`should flow envVars through to commit author`, async () => {
    const provider = new LocalSandboxProvider()
    const sandbox = await provider.create({
      provider: ESandboxType.local,
      envVars: {
        GIT_AUTHOR_NAME: `Custom Author`,
        GIT_AUTHOR_EMAIL: `custom@example.com`,
      },
    })

    await sandbox.exec(`git init`)
    await sandbox.writeFile(`/workspace/file.txt`, `content`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "authored commit"`)

    const log = await sandbox.exec(`git log`)
    expect(log.output).toContain(`Custom Author`)
    expect(log.output).toContain(`custom@example.com`)

    await sandbox.close()
  })

  it(`should support full workflow through provider-created sandbox`, async () => {
    const provider = new LocalSandboxProvider()
    const sandbox = await provider.create({ provider: ESandboxType.local, envVars: {} })

    await sandbox.exec(`git init`)
    await sandbox.writeFile(`/workspace/file.txt`, `v1`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "initial"`)

    await sandbox.exec(`git branch feature`)
    await sandbox.exec(`git checkout feature`)
    await sandbox.writeFile(`/workspace/feature.txt`, `feature work`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "feature work"`)

    await sandbox.exec(`git checkout main`)
    const merge = await sandbox.exec(`git merge feature`)
    expect(merge.success).toBe(true)
    expect(merge.output).toContain(`Fast-forward`)

    // Merge updates refs but not working tree; checkout refreshes it
    await sandbox.exec(`git checkout main`)
    const exists = await sandbox.fileExists(`/workspace/feature.txt`)
    expect(exists).toBe(true)

    await sandbox.close()
  })

  it(`should create fully independent sandboxes`, async () => {
    const provider = new LocalSandboxProvider()
    const sb1 = await provider.create({ provider: ESandboxType.local, envVars: {} })
    const sb2 = await provider.create({ provider: ESandboxType.local, envVars: {} })

    await sb1.exec(`git init`)
    await sb1.writeFile(`/workspace/sb1.txt`, `only in sb1`)
    await sb1.exec(`git add .`)
    await sb1.exec(`git commit -m "sb1 commit"`)

    // sb2 should have no git repo
    const result = await sb2.exec(`git status`)
    expect(result.success).toBe(false)

    await sb1.close()
    await sb2.close()
  })

  it(`should have /workspace ready on provider-created sandbox`, async () => {
    const provider = new LocalSandboxProvider()
    const sandbox = await provider.create({ provider: ESandboxType.local, envVars: {} })

    await sandbox.writeFile(`/workspace/test.txt`, `hello`)
    const content = await sandbox.readFile(`/workspace/test.txt`)
    expect(content).toBe(`hello`)

    await sandbox.close()
  })
})

// ─── 2. git init Variations ──────────────────────────────────────────────

describe(`git init Variations`, () => {
  it(`should support -b flag for custom default branch`, async () => {
    const sandbox = await createSandbox()
    await sandbox.exec(`git init -b develop`)
    await sandbox.writeFile(`/workspace/f.txt`, `x`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "init"`)

    const result = await sandbox.exec(`git rev-parse --abbrev-ref HEAD`)
    expect(result.output.trim()).toBe(`develop`)
  })

  it(`should support --initial-branch flag`, async () => {
    const sandbox = await createSandbox()
    await sandbox.exec(`git init --initial-branch trunk`)
    await sandbox.writeFile(`/workspace/f.txt`, `x`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "init"`)

    const branch = await sandbox.exec(`git branch`)
    expect(branch.output).toContain(`* trunk`)
  })

  it(`should default to main when no flags provided`, async () => {
    const sandbox = await createSandbox()
    await sandbox.exec(`git init`)
    await sandbox.writeFile(`/workspace/f.txt`, `x`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "init"`)

    const result = await sandbox.exec(`git rev-parse --abbrev-ref HEAD`)
    expect(result.output.trim()).toBe(`main`)
  })
})

// ─── 3. git add Variations ───────────────────────────────────────────────

describe(`git add Variations`, () => {
  let sandbox: ISandbox

  beforeEach(async () => {
    sandbox = await createSandbox()
    await initRepo(sandbox)
  })

  it(`should stage deleted files with -A`, async () => {
    await sandbox.deleteFile(`/workspace/seed.txt`)
    await sandbox.exec(`git add -A`)

    const status = await sandbox.exec(`git status`)
    expect(status.output).toContain(`deleted:`)
    expect(status.output).toContain(`seed.txt`)
    expect(status.output).toContain(`Changes to be committed:`)
  })

  it(`should stage deleted files with --all`, async () => {
    await sandbox.deleteFile(`/workspace/seed.txt`)
    await sandbox.exec(`git add --all`)

    const status = await sandbox.exec(`git status`)
    expect(status.output).toContain(`deleted:`)
    expect(status.output).toContain(`seed.txt`)
  })

  it(`should stage only specified file, leaving others untracked`, async () => {
    await sandbox.writeFile(`/workspace/a.txt`, `aaa`)
    await sandbox.writeFile(`/workspace/b.txt`, `bbb`)
    await sandbox.exec(`git add a.txt`)

    const status = await sandbox.exec(`git status`)
    expect(status.output).toContain(`new file:   a.txt`)
    expect(status.output).toContain(`Untracked files:`)
    expect(status.output).toContain(`b.txt`)
  })

  it(`should error with no args`, async () => {
    const result = await sandbox.exec(`git add`)
    expect(result.success).toBe(false)
    expect(result.error).toContain(`Nothing specified`)
  })
})

// ─── 4. git commit Edge Cases ────────────────────────────────────────────

describe(`git commit Edge Cases`, () => {
  it(`should use GIT_COMMITTER_* when GIT_AUTHOR_* not set`, async () => {
    const sandbox = await createSandbox({
      GIT_COMMITTER_NAME: `Committer Bob`,
      GIT_COMMITTER_EMAIL: `bob@example.com`,
    })
    await sandbox.exec(`git init`)
    await sandbox.writeFile(`/workspace/f.txt`, `data`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "by committer"`)

    const log = await sandbox.exec(`git log`)
    expect(log.output).toContain(`Committer Bob`)
    expect(log.output).toContain(`bob@example.com`)
  })

  it(`should default to Agent <agent@tdsk.app> when no env vars set`, async () => {
    const sandbox = await createSandbox()
    await sandbox.exec(`git init`)
    await sandbox.writeFile(`/workspace/f.txt`, `data`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "default author"`)

    const log = await sandbox.exec(`git log`)
    expect(log.output).toContain(`Agent`)
    expect(log.output).toContain(`agent@tdsk.app`)
  })

  it(`should error when -m has no message value`, async () => {
    const sandbox = await createSandbox()
    await sandbox.exec(`git init`)
    await sandbox.writeFile(`/workspace/f.txt`, `data`)
    await sandbox.exec(`git add .`)

    const result = await sandbox.exec(`git commit -m`)
    expect(result.success).toBe(false)
    expect(result.error).toContain(`requires a value`)
  })
})

// ─── 5. git status — All Categories ─────────────────────────────────────

describe(`git status — All Categories`, () => {
  it(`should show staged, unstaged, and untracked simultaneously`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    // Modify tracked file and stage it
    await sandbox.writeFile(`/workspace/seed.txt`, `modified once`)
    await sandbox.exec(`git add .`)

    // Modify it again (unstaged change on top of staged)
    await sandbox.writeFile(`/workspace/seed.txt`, `modified twice`)

    // Add a new untracked file
    await sandbox.writeFile(`/workspace/untracked.txt`, `new file`)

    const status = await sandbox.exec(`git status`)
    expect(status.output).toContain(`Changes to be committed:`)
    expect(status.output).toContain(`Changes not staged for commit:`)
    expect(status.output).toContain(`Untracked files:`)
    expect(status.output).toContain(`untracked.txt`)
  })

  it(`should show staged deletion and untracked file at once`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    // Stage a deletion
    await sandbox.deleteFile(`/workspace/seed.txt`)
    await sandbox.exec(`git add -A`)

    // Add an untracked file
    await sandbox.writeFile(`/workspace/new.txt`, `new`)

    const status = await sandbox.exec(`git status`)
    expect(status.output).toContain(`Changes to be committed:`)
    expect(status.output).toContain(`deleted:`)
    expect(status.output).toContain(`Untracked files:`)
    expect(status.output).toContain(`new.txt`)
  })
})

// ─── 6. git log Depth and Format ─────────────────────────────────────────

describe(`git log Depth and Format`, () => {
  let sandbox: ISandbox

  beforeEach(async () => {
    sandbox = await createSandbox()
    await sandbox.exec(`git init`)
    for (let i = 1; i <= 3; i++) {
      await sandbox.writeFile(`/workspace/file${i}.txt`, `content ${i}`)
      await sandbox.exec(`git add .`)
      await sandbox.exec(`git commit -m "commit ${i}"`)
    }
  })

  it(`should show 3 commits in newest-first order with unique SHAs`, async () => {
    const log = await sandbox.exec(`git log --oneline`)
    const lines = log.output.trim().split(`\n`)
    expect(lines).toHaveLength(3)

    // newest first
    expect(lines[0]).toContain(`commit 3`)
    expect(lines[2]).toContain(`commit 1`)

    // unique SHAs (first 7 chars)
    const shas = lines.map((l) => l.split(` `)[0])
    expect(new Set(shas).size).toBe(3)
  })

  it(`should limit output with -n flag`, async () => {
    const log = await sandbox.exec(`git log --oneline -n 2`)
    const lines = log.output.trim().split(`\n`)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain(`commit 3`)
    expect(lines[1]).toContain(`commit 2`)
  })

  it(`should show full format with SHA, Author, Date, and indented message`, async () => {
    const log = await sandbox.exec(`git log -n 1`)
    expect(log.output).toMatch(/commit [0-9a-f]{40}/)
    expect(log.output).toContain(`Author:`)
    expect(log.output).toContain(`Date:`)
    expect(log.output).toContain(`    commit 3`)
  })
})

// ─── 7. Merge Workflows ─────────────────────────────────────────────────

describe(`Merge Workflows`, () => {
  it(`should fast-forward merge when feature is ahead`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    await sandbox.exec(`git branch feature`)
    await sandbox.exec(`git checkout feature`)
    await sandbox.writeFile(`/workspace/feature.txt`, `feature content`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "feature commit"`)

    await sandbox.exec(`git checkout main`)
    const merge = await sandbox.exec(`git merge feature`)
    expect(merge.success).toBe(true)
    expect(merge.output).toContain(`Fast-forward`)

    // Merge updates refs but not working tree; checkout refreshes it
    await sandbox.exec(`git checkout main`)
    const exists = await sandbox.fileExists(`/workspace/feature.txt`)
    expect(exists).toBe(true)
  })

  it(`should report already up to date when no new commits`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    await sandbox.exec(`git branch feature`)
    // No commits on feature beyond what main already has

    const merge = await sandbox.exec(`git merge feature`)
    expect(merge.success).toBe(true)
    expect(merge.output).toContain(`Already up to date.`)
  })

  it(`should create recursive merge when both branches diverged`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    // Commit on feature
    await sandbox.exec(`git branch feature`)
    await sandbox.exec(`git checkout feature`)
    await sandbox.writeFile(`/workspace/feature.txt`, `from feature`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "feature work"`)

    // Commit on main
    await sandbox.exec(`git checkout main`)
    await sandbox.writeFile(`/workspace/main.txt`, `from main`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "main work"`)

    const merge = await sandbox.exec(`git merge feature`)
    expect(merge.success).toBe(true)
    expect(merge.output).toContain(`Merge made by the 'recursive' strategy.`)

    // Merge updates refs but not working tree; checkout refreshes it
    await sandbox.exec(`git checkout main`)
    expect(await sandbox.fileExists(`/workspace/feature.txt`)).toBe(true)
    expect(await sandbox.fileExists(`/workspace/main.txt`)).toBe(true)
  })
})

// ─── 8. Branch Operations ───────────────────────────────────────────────

describe(`Branch Operations`, () => {
  it(`should delete a branch with -d`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    await sandbox.exec(`git branch feature`)
    const del = await sandbox.exec(`git branch -d feature`)
    expect(del.success).toBe(true)
    expect(del.output).toContain(`Deleted branch feature`)

    const branches = await sandbox.exec(`git branch`)
    expect(branches.output).not.toContain(`feature`)
  })

  it(`should allow deleting current branch (isomorphic-git permits this)`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    const result = await sandbox.exec(`git branch -d main`)
    expect(result.success).toBe(true)
    expect(result.output).toContain(`Deleted branch main`)
  })

  it(`should list multiple branches with * on current`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    await sandbox.exec(`git branch alpha`)
    await sandbox.exec(`git branch beta`)

    const branches = await sandbox.exec(`git branch`)
    expect(branches.output).toContain(`* main`)
    expect(branches.output).toContain(`alpha`)
    expect(branches.output).toContain(`beta`)
  })
})

// ─── 9. rev-parse ────────────────────────────────────────────────────────

describe(`rev-parse`, () => {
  it(`should return 40-char hex SHA for HEAD`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    const result = await sandbox.exec(`git rev-parse HEAD`)
    expect(result.success).toBe(true)
    expect(result.output.trim()).toMatch(/^[0-9a-f]{40}$/)
  })

  it(`should fail on empty repo with no commits`, async () => {
    const sandbox = await createSandbox()
    await sandbox.exec(`git init`)

    const result = await sandbox.exec(`git rev-parse HEAD`)
    expect(result.success).toBe(false)
    expect(result.error).toContain(`Could not find`)
  })
})

// ─── 10. git diff Behavior ──────────────────────────────────────────────

describe(`git diff Behavior`, () => {
  it(`should return empty after staging all changes`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    await sandbox.writeFile(`/workspace/seed.txt`, `changed`)
    await sandbox.exec(`git add .`)

    const diff = await sandbox.exec(`git diff`)
    expect(diff.success).toBe(true)
    expect(diff.output.trim()).toBe(``)
  })

  it(`should show deleted file in diff`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    // Stage seed.txt as-is (already committed), then delete without staging
    await sandbox.deleteFile(`/workspace/seed.txt`)

    const diff = await sandbox.exec(`git diff`)
    expect(diff.success).toBe(true)
    expect(diff.output).toContain(`deleted:`)
    expect(diff.output).toContain(`seed.txt`)
  })

  it(`should show only modified files, not unmodified ones`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    // Add a second committed file
    await sandbox.writeFile(`/workspace/stable.txt`, `stable`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "add stable"`)

    // Only modify seed.txt
    await sandbox.writeFile(`/workspace/seed.txt`, `changed seed`)

    const diff = await sandbox.exec(`git diff`)
    expect(diff.output).toContain(`seed.txt`)
    expect(diff.output).not.toContain(`stable.txt`)
  })
})

// ─── 11. Error Paths ────────────────────────────────────────────────────

describe(`Error Paths`, () => {
  it(`should fail git status on uninitialized repo`, async () => {
    const sandbox = await createSandbox()

    const result = await sandbox.exec(`git status`)
    expect(result.success).toBe(false)
  })

  it(`should error on unknown subcommand`, async () => {
    const sandbox = await createSandbox()

    const result = await sandbox.exec(`git foobar`)
    expect(result.success).toBe(false)
    expect(result.error).toContain(`'foobar' is not a git command`)
  })

  it(`should show usage when no subcommand given`, async () => {
    const sandbox = await createSandbox()

    const result = await sandbox.exec(`git`)
    expect(result.success).toBe(false)
    expect(result.error).toContain(`usage: git`)
  })

  it(`should fail checkout of nonexistent branch`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    const result = await sandbox.exec(`git checkout nonexistent`)
    expect(result.success).toBe(false)
  })
})

// ─── 12. Sandbox Reset ──────────────────────────────────────────────────

describe(`Sandbox Reset`, () => {
  it(`should clear workspace files but preserve .git (non-empty dir survives rm)`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    // Verify file exists before reset
    const before = await sandbox.fileExists(`/workspace/seed.txt`)
    expect(before).toBe(true)

    await sandbox.reset()

    // Files are cleared
    const after = await sandbox.fileExists(`/workspace/seed.txt`)
    expect(after).toBe(false)

    // .git survives reset (non-empty directory can't be rm'd)
    // so git status still works
    const status = await sandbox.exec(`git status`)
    expect(status.success).toBe(true)
  })

  it(`should clear user files while preserving git history after reset`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    await sandbox.reset()

    // Git history survives (.git is non-empty dir)
    const log = await sandbox.exec(`git log --oneline`)
    expect(log.output).toContain(`seed commit`)

    // But workspace files are gone
    const exists = await sandbox.fileExists(`/workspace/seed.txt`)
    expect(exists).toBe(false)
  })
})

// ─── 13. Multi-File and Sequential Commits ──────────────────────────────

describe(`Multi-File and Sequential Commits`, () => {
  it(`should handle files in nested subdirectories`, async () => {
    const sandbox = await createSandbox()
    await sandbox.exec(`git init`)

    await sandbox.mkdir(`/workspace/src`)
    await sandbox.mkdir(`/workspace/docs`)
    await sandbox.writeFile(`/workspace/src/a.ts`, `export const a = 1`)
    await sandbox.writeFile(`/workspace/docs/readme.md`, `# Docs`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "add nested files"`)

    const status = await sandbox.exec(`git status`)
    expect(status.output).toContain(`nothing to commit, working tree clean`)
  })

  it(`should track modifications across sequential commits`, async () => {
    const sandbox = await createSandbox()
    await sandbox.exec(`git init`)

    await sandbox.writeFile(`/workspace/counter.txt`, `1`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "count 1"`)

    await sandbox.writeFile(`/workspace/counter.txt`, `2`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "count 2"`)

    await sandbox.writeFile(`/workspace/counter.txt`, `3`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "count 3"`)

    // All 3 commits in log
    const log = await sandbox.exec(`git log --oneline`)
    const lines = log.output.trim().split(`\n`)
    expect(lines).toHaveLength(3)

    // File has latest content
    const content = await sandbox.readFile(`/workspace/counter.txt`)
    expect(content).toBe(`3`)
  })
})

// ─── 14. git switch ────────────────────────────────────────────────────

describe(`git switch`, () => {
  it(`should switch to an existing branch`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)
    await sandbox.exec(`git branch feature`)

    const result = await sandbox.exec(`git switch feature`)
    expect(result.success).toBe(true)
    expect(result.output).toContain(`Switched to branch 'feature'`)

    const branch = await sandbox.exec(`git rev-parse --abbrev-ref HEAD`)
    expect(branch.output.trim()).toBe(`feature`)
  })

  it(`should create and switch with -c`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    const result = await sandbox.exec(`git switch -c new-branch`)
    expect(result.success).toBe(true)
    expect(result.output).toContain(`Switched to a new branch 'new-branch'`)

    const branch = await sandbox.exec(`git rev-parse --abbrev-ref HEAD`)
    expect(branch.output.trim()).toBe(`new-branch`)
  })

  it(`should error on nonexistent branch`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    const result = await sandbox.exec(`git switch nonexistent`)
    expect(result.success).toBe(false)
    expect(result.error).toContain(`invalid reference`)
  })
})

// ─── 15. git tag ───────────────────────────────────────────────────────

describe(`git tag`, () => {
  it(`should list empty tags`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    const result = await sandbox.exec(`git tag`)
    expect(result.success).toBe(true)
    expect(result.output.trim()).toBe(``)
  })

  it(`should create lightweight tag`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    const create = await sandbox.exec(`git tag v1.0`)
    expect(create.success).toBe(true)

    const list = await sandbox.exec(`git tag`)
    expect(list.output).toContain(`v1.0`)
  })

  it(`should create annotated tag with -a -m`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    const create = await sandbox.exec(`git tag -a v2.0 -m "Release v2.0"`)
    expect(create.success).toBe(true)

    const list = await sandbox.exec(`git tag`)
    expect(list.output).toContain(`v2.0`)
  })

  it(`should delete tag with -d`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)
    await sandbox.exec(`git tag v1.0`)

    const del = await sandbox.exec(`git tag -d v1.0`)
    expect(del.success).toBe(true)
    expect(del.output).toContain(`Deleted tag 'v1.0'`)

    const list = await sandbox.exec(`git tag`)
    expect(list.output.trim()).toBe(``)
  })

  it(`should list multiple tags`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)
    await sandbox.exec(`git tag v1.0`)
    await sandbox.exec(`git tag v2.0`)

    const list = await sandbox.exec(`git tag`)
    expect(list.output).toContain(`v1.0`)
    expect(list.output).toContain(`v2.0`)
  })
})

// ─── 16. git remote ────────────────────────────────────────────────────

describe(`git remote`, () => {
  it(`should list empty remotes`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    const result = await sandbox.exec(`git remote`)
    expect(result.success).toBe(true)
    expect(result.output.trim()).toBe(``)
  })

  it(`should add a remote`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    const add = await sandbox.exec(`git remote add origin https://example.com/repo.git`)
    expect(add.success).toBe(true)

    const list = await sandbox.exec(`git remote`)
    expect(list.output).toContain(`origin`)
  })

  it(`should remove a remote`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)
    await sandbox.exec(`git remote add origin https://example.com/repo.git`)

    const rm = await sandbox.exec(`git remote remove origin`)
    expect(rm.success).toBe(true)

    const list = await sandbox.exec(`git remote`)
    expect(list.output.trim()).toBe(``)
  })

  it(`should show URLs with -v`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)
    await sandbox.exec(`git remote add origin https://example.com/repo.git`)

    const result = await sandbox.exec(`git remote -v`)
    expect(result.success).toBe(true)
    expect(result.output).toContain(`origin`)
    expect(result.output).toContain(`https://example.com/repo.git`)
  })
})

// ─── 17. git reset ─────────────────────────────────────────────────────

describe(`git reset`, () => {
  it(`should unstage a specific file`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    await sandbox.writeFile(`/workspace/a.txt`, `aaa`)
    await sandbox.writeFile(`/workspace/b.txt`, `bbb`)
    await sandbox.exec(`git add .`)

    await sandbox.exec(`git reset a.txt`)

    const status = await sandbox.exec(`git status`)
    // b.txt should still be staged
    expect(status.output).toContain(`new file:   b.txt`)
    // a.txt should be untracked now
    expect(status.output).toContain(`Untracked files:`)
    expect(status.output).toContain(`a.txt`)
  })

  it(`should unstage all files`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    await sandbox.writeFile(`/workspace/a.txt`, `aaa`)
    await sandbox.writeFile(`/workspace/b.txt`, `bbb`)
    await sandbox.exec(`git add .`)

    await sandbox.exec(`git reset`)

    const status = await sandbox.exec(`git status`)
    expect(status.output).not.toContain(`Changes to be committed:`)
    expect(status.output).toContain(`Untracked files:`)
  })

  it(`should not change working tree`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    await sandbox.writeFile(`/workspace/a.txt`, `content`)
    await sandbox.exec(`git add a.txt`)
    await sandbox.exec(`git reset a.txt`)

    // File should still exist in working tree
    const content = await sandbox.readFile(`/workspace/a.txt`)
    expect(content).toBe(`content`)
  })
})

// ─── 18. git rm ────────────────────────────────────────────────────────

describe(`git rm`, () => {
  it(`should remove file from index and working tree`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    const result = await sandbox.exec(`git rm seed.txt`)
    expect(result.success).toBe(true)
    expect(result.output).toContain(`rm 'seed.txt'`)

    // File should be gone from working tree
    const exists = await sandbox.fileExists(`/workspace/seed.txt`)
    expect(exists).toBe(false)

    // Should be staged as deletion
    const status = await sandbox.exec(`git status`)
    expect(status.output).toContain(`deleted:`)
  })

  it(`should remove from index only with --cached`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    const result = await sandbox.exec(`git rm --cached seed.txt`)
    expect(result.success).toBe(true)

    // File should still exist in working tree
    const exists = await sandbox.fileExists(`/workspace/seed.txt`)
    expect(exists).toBe(true)

    // Shows as staged deletion (removed from index but was in HEAD)
    const status = await sandbox.exec(`git status`)
    expect(status.output).toContain(`Changes to be committed:`)
    expect(status.output).toContain(`deleted:`)
    expect(status.output).toContain(`seed.txt`)
  })

  it(`should fail without filepath`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    const result = await sandbox.exec(`git rm`)
    expect(result.success).toBe(false)
    expect(result.error).toContain(`usage:`)
  })
})

// ─── 19. git show ──────────────────────────────────────────────────────

describe(`git show`, () => {
  it(`should show HEAD commit`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    const result = await sandbox.exec(`git show`)
    expect(result.success).toBe(true)
    expect(result.output).toMatch(/commit [0-9a-f]{40}/)
    expect(result.output).toContain(`Author:`)
    expect(result.output).toContain(`seed commit`)
  })

  it(`should show commit by SHA`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    const rev = await sandbox.exec(`git rev-parse HEAD`)
    const sha = rev.output.trim()

    const result = await sandbox.exec(`git show ${sha}`)
    expect(result.success).toBe(true)
    expect(result.output).toContain(`commit ${sha}`)
    expect(result.output).toContain(`seed commit`)
  })

  it(`should error on empty repo`, async () => {
    const sandbox = await createSandbox()
    await sandbox.exec(`git init`)

    const result = await sandbox.exec(`git show`)
    expect(result.success).toBe(false)
  })
})

// ─── 20. git cherry-pick ───────────────────────────────────────────────

describe(`git cherry-pick`, () => {
  it(`should apply commit from another branch`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    // Create a commit on a feature branch
    await sandbox.exec(`git branch feature`)
    await sandbox.exec(`git checkout feature`)
    await sandbox.writeFile(`/workspace/feature.txt`, `cherry content`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "feature commit"`)

    // Get the OID of the feature commit
    const rev = await sandbox.exec(`git rev-parse HEAD`)
    const featureOid = rev.output.trim()

    // Go back to main
    await sandbox.exec(`git checkout main`)

    // Cherry-pick
    const result = await sandbox.exec(`git cherry-pick ${featureOid}`)
    expect(result.success).toBe(true)

    // The file should appear after checkout
    await sandbox.exec(`git checkout main`)
    const exists = await sandbox.fileExists(`/workspace/feature.txt`)
    expect(exists).toBe(true)
  })

  it(`should fail without oid`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    const result = await sandbox.exec(`git cherry-pick`)
    expect(result.success).toBe(false)
    expect(result.error).toContain(`must specify a commit`)
  })

  it(`should preserve cherry-picked content on branch`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    await sandbox.exec(`git branch feature`)
    await sandbox.exec(`git checkout feature`)
    await sandbox.writeFile(`/workspace/picked.txt`, `picked`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git commit -m "to be picked"`)

    const rev = await sandbox.exec(`git rev-parse HEAD`)
    const oid = rev.output.trim()

    await sandbox.exec(`git checkout main`)
    await sandbox.exec(`git cherry-pick ${oid}`)
    await sandbox.exec(`git checkout main`)

    const content = await sandbox.readFile(`/workspace/picked.txt`)
    expect(content).toBe(`picked`)
  })
})

// ─── 21. git stash ─────────────────────────────────────────────────────

describe(`git stash`, { timeout: 10000 }, () => {
  it(`should stash and restore changes`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    await sandbox.writeFile(`/workspace/seed.txt`, `modified`)
    await sandbox.exec(`git add .`)

    const stash = await sandbox.exec(`git stash`)
    expect(stash.success).toBe(true)
    expect(stash.output).toContain(`Saved working directory`)

    // After stash, working tree should be clean
    const status = await sandbox.exec(`git status`)
    expect(status.output).toContain(`nothing to commit`)

    // Pop restores
    const pop = await sandbox.exec(`git stash pop`)
    expect(pop.success).toBe(true)
  })

  it(`should list stash entries`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    await sandbox.writeFile(`/workspace/seed.txt`, `modified`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git stash`)

    const list = await sandbox.exec(`git stash list`)
    expect(list.success).toBe(true)
    expect(list.output.length).toBeGreaterThan(0)
  })

  it(`should clear all stash entries`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    await sandbox.writeFile(`/workspace/seed.txt`, `modified`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git stash`)

    const clear = await sandbox.exec(`git stash clear`)
    expect(clear.success).toBe(true)

    const list = await sandbox.exec(`git stash list`)
    expect(list.output.trim()).toBe(``)
  })

  it(`should drop a specific stash entry`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    await sandbox.writeFile(`/workspace/seed.txt`, `modified`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git stash`)

    const drop = await sandbox.exec(`git stash drop 0`)
    expect(drop.success).toBe(true)
  })

  it(`should apply without removing stash entry`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)

    await sandbox.writeFile(`/workspace/seed.txt`, `modified`)
    await sandbox.exec(`git add .`)
    await sandbox.exec(`git stash`)

    const apply = await sandbox.exec(`git stash apply`)
    expect(apply.success).toBe(true)
  })
})

// ─── 22. git clone (error handling) ────────────────────────────────────

// A closed loopback port refuses the TCP connection immediately (no DNS
// lookup, no OS-level connect timeout to race against vitest's test
// timeout), unlike a real unresolvable hostname such as invalid.example.com
// which sometimes hangs until vitest's 5000ms timeout fires (flaky in CI —
// see gh run 28833662888).
const UNREACHABLE_REMOTE = `http://127.0.0.1:1/repo.git`

describe(`git clone`, { timeout: 10000 }, () => {
  it(`should error without URL`, async () => {
    const sandbox = await createSandbox()

    const result = await sandbox.exec(`git clone`)
    expect(result.success).toBe(false)
    expect(result.error).toContain(`must specify a repository`)
  })

  it(`should parse --depth flag`, async () => {
    const sandbox = await createSandbox()
    // Will fail since no actual server, but the arg parsing is tested
    const result = await sandbox.exec(`git clone ${UNREACHABLE_REMOTE} --depth 1`)
    // Expect network error, not arg-parsing error
    expect(result.success).toBe(false)
    expect(result.error).not.toContain(`must specify a repository`)
  })

  it(`should parse --branch flag`, async () => {
    const sandbox = await createSandbox()
    const result = await sandbox.exec(`git clone ${UNREACHABLE_REMOTE} --branch develop`)
    expect(result.success).toBe(false)
    expect(result.error).not.toContain(`must specify a repository`)
  })
})

// ─── 23. git fetch (error handling) ────────────────────────────────────

describe(`git fetch`, { timeout: 10000 }, () => {
  it(`should error without remote`, async () => {
    const sandbox = await createSandbox()

    const result = await sandbox.exec(`git fetch`)
    expect(result.success).toBe(false)
    expect(result.error).toContain(`No remote repository`)
  })

  it(`should parse --prune flag`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)
    await sandbox.exec(`git remote add origin ${UNREACHABLE_REMOTE}`)

    const result = await sandbox.exec(`git fetch origin --prune`)
    expect(result.success).toBe(false)
    // Error should be network/git error, not arg-parsing error
    expect(result.error).not.toContain(`No remote repository`)
  })
})

// ─── 24. git pull (error handling) ─────────────────────────────────────

describe(`git pull`, { timeout: 10000 }, () => {
  it(`should error without remote`, async () => {
    const sandbox = await createSandbox()

    const result = await sandbox.exec(`git pull`)
    expect(result.success).toBe(false)
    expect(result.error).toContain(`No remote repository`)
  })

  it(`should parse --ff-only flag`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)
    await sandbox.exec(`git remote add origin ${UNREACHABLE_REMOTE}`)

    const result = await sandbox.exec(`git pull origin --ff-only`)
    expect(result.success).toBe(false)
    expect(result.error).not.toContain(`No remote repository`)
  })
})

// ─── 25. git push (error handling) ─────────────────────────────────────

describe(`git push`, { timeout: 10000 }, () => {
  it(`should error without remote`, async () => {
    const sandbox = await createSandbox()

    const result = await sandbox.exec(`git push`)
    expect(result.success).toBe(false)
    expect(result.error).toContain(`No remote repository`)
  })

  it(`should parse --force flag`, async () => {
    const sandbox = await createSandbox()
    await initRepo(sandbox)
    await sandbox.exec(`git remote add origin ${UNREACHABLE_REMOTE}`)

    const result = await sandbox.exec(`git push origin --force`)
    expect(result.success).toBe(false)
    expect(result.error).not.toContain(`No remote repository`)
  })
})
