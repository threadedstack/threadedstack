import { describe, it, expect, vi, beforeEach } from 'vitest'
import git from 'isomorphic-git'
import { gitCommand } from './gitCommand'

vi.mock(`isomorphic-git/http/node`, () => ({ default: {} }))

vi.mock(`isomorphic-git`, () => ({
  default: {
    init: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    commit: vi.fn(),
    statusMatrix: vi.fn(),
    log: vi.fn(),
    listBranches: vi.fn(),
    branch: vi.fn(),
    deleteBranch: vi.fn(),
    checkout: vi.fn(),
    merge: vi.fn(),
    currentBranch: vi.fn(),
    listTags: vi.fn(),
    tag: vi.fn(),
    annotatedTag: vi.fn(),
    deleteTag: vi.fn(),
    listRemotes: vi.fn(),
    addRemote: vi.fn(),
    deleteRemote: vi.fn(),
    resetIndex: vi.fn(),
    resolveRef: vi.fn(),
    readCommit: vi.fn(),
    cherryPick: vi.fn(),
    stash: vi.fn(),
    setConfig: vi.fn(),
    clone: vi.fn(),
    fetch: vi.fn(),
    pull: vi.fn(),
    push: vi.fn(),
  },
}))

const mockGit = vi.mocked(git)

const mockCtx: any = {
  fs: {
    readFile: vi.fn(),
    readFileBuffer: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn(),
    stat: vi.fn(),
    lstat: vi.fn(),
    readdir: vi.fn(),
    readlink: vi.fn(),
    symlink: vi.fn(),
  },
  cwd: `/workspace`,
  env: {},
  stdin: ``,
}

describe(`gitCommand`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.env = {}
  })

  it(`should have name 'git'`, () => {
    expect(gitCommand.name).toBe(`git`)
  })

  describe(`no subcommand`, () => {
    it(`should return usage when no args provided`, async () => {
      const result = await gitCommand.execute([], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`usage: git`)
    })
  })

  describe(`unknown subcommand`, () => {
    it(`should return error for unknown subcommand`, async () => {
      const result = await gitCommand.execute([`foobar`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`'foobar' is not a git command`)
    })
  })

  describe(`init`, () => {
    it(`should initialize a git repository`, async () => {
      mockGit.init.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`init`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`Initialized empty Git repository`)
      expect(mockGit.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dir: `/workspace`,
          defaultBranch: `main`,
        })
      )
    })

    it(`should support -b flag for initial branch`, async () => {
      mockGit.init.mockResolvedValue(undefined)

      await gitCommand.execute([`init`, `-b`, `develop`], mockCtx)

      expect(mockGit.init).toHaveBeenCalledWith(
        expect.objectContaining({ defaultBranch: `develop` })
      )
    })

    it(`should support --initial-branch flag`, async () => {
      mockGit.init.mockResolvedValue(undefined)

      await gitCommand.execute([`init`, `--initial-branch`, `trunk`], mockCtx)

      expect(mockGit.init).toHaveBeenCalledWith(
        expect.objectContaining({ defaultBranch: `trunk` })
      )
    })
  })

  describe(`add`, () => {
    it(`should add a specific file`, async () => {
      mockGit.add.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`add`, `file.txt`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.add).toHaveBeenCalledWith(
        expect.objectContaining({
          dir: `/workspace`,
          filepath: `file.txt`,
        })
      )
    })

    it(`should add all files with dot`, async () => {
      mockGit.statusMatrix.mockResolvedValue([
        [`new.txt`, 0, 2, 0],
        [`modified.txt`, 1, 2, 1],
        [`unchanged.txt`, 1, 1, 1],
      ])
      mockGit.add.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`add`, `.`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.add).toHaveBeenCalledTimes(2)
      expect(mockGit.add).toHaveBeenCalledWith(
        expect.objectContaining({ filepath: `new.txt` })
      )
      expect(mockGit.add).toHaveBeenCalledWith(
        expect.objectContaining({ filepath: `modified.txt` })
      )
    })

    it(`should remove deleted files when adding all`, async () => {
      mockGit.statusMatrix.mockResolvedValue([[`deleted.txt`, 1, 0, 1]])
      mockGit.remove.mockResolvedValue(undefined)

      await gitCommand.execute([`add`, `.`], mockCtx)

      expect(mockGit.remove).toHaveBeenCalledWith(
        expect.objectContaining({ filepath: `deleted.txt` })
      )
    })

    it(`should support -A flag`, async () => {
      mockGit.statusMatrix.mockResolvedValue([])

      const result = await gitCommand.execute([`add`, `-A`], mockCtx)
      expect(result.exitCode).toBe(0)
      expect(mockGit.statusMatrix).toHaveBeenCalled()
    })

    it(`should support --all flag`, async () => {
      mockGit.statusMatrix.mockResolvedValue([])

      const result = await gitCommand.execute([`add`, `--all`], mockCtx)
      expect(result.exitCode).toBe(0)
      expect(mockGit.statusMatrix).toHaveBeenCalled()
    })

    it(`should fail when nothing specified`, async () => {
      const result = await gitCommand.execute([`add`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`Nothing specified`)
    })

    it(`should re-add file removed from index [1,1,0]`, async () => {
      mockGit.statusMatrix.mockResolvedValue([[`file.txt`, 1, 1, 0]])
      mockGit.add.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`add`, `-A`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.add).toHaveBeenCalledWith(
        expect.objectContaining({ filepath: `file.txt` })
      )
    })

    it(`should not re-add file already cleanly staged [1,2,2]`, async () => {
      mockGit.statusMatrix.mockResolvedValue([[`already-staged.txt`, 1, 2, 2]])

      const result = await gitCommand.execute([`add`, `-A`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.add).not.toHaveBeenCalled()
      expect(mockGit.remove).not.toHaveBeenCalled()
    })
  })

  describe(`commit`, () => {
    it(`should commit with message`, async () => {
      mockGit.commit.mockResolvedValue(`abc1234def5678`)
      mockGit.currentBranch.mockResolvedValue(`main`)

      const result = await gitCommand.execute([`commit`, `-m`, `initial commit`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`[main abc1234]`)
      expect(result.stdout).toContain(`initial commit`)
      expect(mockGit.commit).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `initial commit`,
          author: { name: `Agent`, email: `agent@tdsk.app` },
        })
      )
    })

    it(`should use env vars for author`, async () => {
      mockCtx.env = {
        GIT_AUTHOR_NAME: `Test User`,
        GIT_AUTHOR_EMAIL: `test@example.com`,
      }
      mockGit.commit.mockResolvedValue(`aaa1111`)
      mockGit.currentBranch.mockResolvedValue(`main`)

      await gitCommand.execute([`commit`, `-m`, `msg`], mockCtx)

      expect(mockGit.commit).toHaveBeenCalledWith(
        expect.objectContaining({
          author: { name: `Test User`, email: `test@example.com` },
        })
      )
    })

    it(`should fail without -m flag`, async () => {
      const result = await gitCommand.execute([`commit`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`switch 'm' requires a value`)
    })

    it(`should fail with -m but no message`, async () => {
      const result = await gitCommand.execute([`commit`, `-m`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`switch 'm' requires a value`)
    })
  })

  describe(`status`, () => {
    it(`should show clean status`, async () => {
      mockGit.currentBranch.mockResolvedValue(`main`)
      mockGit.statusMatrix.mockResolvedValue([[`file.txt`, 1, 1, 1]])

      const result = await gitCommand.execute([`status`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`On branch main`)
      expect(result.stdout).toContain(`nothing to commit`)
    })

    it(`should show untracked files`, async () => {
      mockGit.currentBranch.mockResolvedValue(`main`)
      mockGit.statusMatrix.mockResolvedValue([[`new.txt`, 0, 2, 0]])

      const result = await gitCommand.execute([`status`], mockCtx)

      expect(result.stdout).toContain(`Untracked files:`)
      expect(result.stdout).toContain(`new.txt`)
    })

    it(`should show staged new files`, async () => {
      mockGit.currentBranch.mockResolvedValue(`main`)
      mockGit.statusMatrix.mockResolvedValue([[`added.txt`, 0, 2, 3]])

      const result = await gitCommand.execute([`status`], mockCtx)

      expect(result.stdout).toContain(`Changes to be committed:`)
      expect(result.stdout).toContain(`new file:   added.txt`)
    })

    it(`should show staged modifications`, async () => {
      mockGit.currentBranch.mockResolvedValue(`main`)
      mockGit.statusMatrix.mockResolvedValue([[`mod.txt`, 1, 2, 2]])

      const result = await gitCommand.execute([`status`], mockCtx)

      expect(result.stdout).toContain(`Changes to be committed:`)
      expect(result.stdout).toContain(`modified:   mod.txt`)
    })

    it(`should show unstaged modifications`, async () => {
      mockGit.currentBranch.mockResolvedValue(`main`)
      mockGit.statusMatrix.mockResolvedValue([[`changed.txt`, 1, 2, 1]])

      const result = await gitCommand.execute([`status`], mockCtx)

      expect(result.stdout).toContain(`Changes not staged for commit:`)
      expect(result.stdout).toContain(`modified:   changed.txt`)
    })

    it(`should show staged deletion when stage=0 and head=1`, async () => {
      mockGit.currentBranch.mockResolvedValue(`main`)
      mockGit.statusMatrix.mockResolvedValue([[`removed.txt`, 1, 0, 0]])

      const result = await gitCommand.execute([`status`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`Changes to be committed:`)
      expect(result.stdout).toContain(`deleted:    removed.txt`)
    })

    it(`should handle stage=3 unstaged modification`, async () => {
      mockGit.currentBranch.mockResolvedValue(`main`)
      mockGit.statusMatrix.mockResolvedValue([[`both.txt`, 1, 2, 3]])

      const result = await gitCommand.execute([`status`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`Changes to be committed:`)
      expect(result.stdout).toContain(`modified:   both.txt`)
      expect(result.stdout).toContain(`Changes not staged for commit:`)
    })
  })

  describe(`log`, () => {
    const fakeCommit = (oid: string, message: string) => ({
      oid,
      commit: {
        message,
        tree: `tree123`,
        parent: [],
        author: {
          name: `Agent`,
          email: `agent@tdsk.app`,
          timestamp: 1700000000,
          timezoneOffset: 0,
        },
        committer: {
          name: `Agent`,
          email: `agent@tdsk.app`,
          timestamp: 1700000000,
          timezoneOffset: 0,
        },
      },
      payload: ``,
    })

    it(`should show full log`, async () => {
      mockGit.log.mockResolvedValue([fakeCommit(`abc1234567890`, `first commit`)])

      const result = await gitCommand.execute([`log`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`commit abc1234567890`)
      expect(result.stdout).toContain(`Author: Agent <agent@tdsk.app>`)
      expect(result.stdout).toContain(`first commit`)
    })

    it(`should support --oneline format`, async () => {
      mockGit.log.mockResolvedValue([fakeCommit(`abc1234567890`, `first commit`)])

      const result = await gitCommand.execute([`log`, `--oneline`], mockCtx)

      expect(result.stdout).toContain(`abc1234 first commit`)
      expect(result.stdout).not.toContain(`Author:`)
    })

    it(`should support -n depth limit`, async () => {
      mockGit.log.mockResolvedValue([])

      await gitCommand.execute([`log`, `-n`, `5`], mockCtx)

      expect(mockGit.log).toHaveBeenCalledWith(expect.objectContaining({ depth: 5 }))
    })

    it(`should handle empty log`, async () => {
      mockGit.log.mockResolvedValue([])

      const result = await gitCommand.execute([`log`], mockCtx)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe(``)
    })
  })

  describe(`branch`, () => {
    it(`should list branches`, async () => {
      mockGit.listBranches.mockResolvedValue([`main`, `develop`])
      mockGit.currentBranch.mockResolvedValue(`main`)

      const result = await gitCommand.execute([`branch`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`* main`)
      expect(result.stdout).toContain(`  develop`)
    })

    it(`should create a branch`, async () => {
      mockGit.branch.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`branch`, `feature`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.branch).toHaveBeenCalledWith(
        expect.objectContaining({ ref: `feature` })
      )
    })

    it(`should delete a branch with -d`, async () => {
      mockGit.deleteBranch.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`branch`, `-d`, `old`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`Deleted branch old`)
      expect(mockGit.deleteBranch).toHaveBeenCalledWith(
        expect.objectContaining({ ref: `old` })
      )
    })

    it(`should delete a branch with -D`, async () => {
      mockGit.deleteBranch.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`branch`, `-D`, `force`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.deleteBranch).toHaveBeenCalledWith(
        expect.objectContaining({ ref: `force` })
      )
    })

    it(`should fail delete without branch name`, async () => {
      const result = await gitCommand.execute([`branch`, `-d`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`branch name required`)
    })
  })

  describe(`checkout`, () => {
    it(`should checkout an existing branch`, async () => {
      mockGit.checkout.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`checkout`, `develop`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`Switched to branch 'develop'`)
      expect(mockGit.checkout).toHaveBeenCalledWith(
        expect.objectContaining({ ref: `develop` })
      )
    })

    it(`should create and checkout with -b`, async () => {
      mockGit.branch.mockResolvedValue(undefined)
      mockGit.checkout.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`checkout`, `-b`, `feature`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`Switched to a new branch 'feature'`)
      expect(mockGit.branch).toHaveBeenCalledWith(
        expect.objectContaining({ ref: `feature` })
      )
      expect(mockGit.checkout).toHaveBeenCalledWith(
        expect.objectContaining({ ref: `feature` })
      )
    })

    it(`should fail -b without name`, async () => {
      const result = await gitCommand.execute([`checkout`, `-b`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`switch 'b' requires a value`)
    })

    it(`should fail without branch ref`, async () => {
      const result = await gitCommand.execute([`checkout`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`must specify a branch`)
    })
  })

  describe(`merge`, () => {
    it(`should merge a branch`, async () => {
      mockGit.merge.mockResolvedValue({
        oid: `merge123`,
        alreadyMerged: false,
        fastForward: false,
      })

      const result = await gitCommand.execute([`merge`, `feature`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`Merge made`)
      expect(mockGit.merge).toHaveBeenCalledWith(
        expect.objectContaining({
          theirs: `feature`,
          author: { name: `Agent`, email: `agent@tdsk.app` },
        })
      )
    })

    it(`should report fast-forward`, async () => {
      mockGit.merge.mockResolvedValue({
        oid: `ff123`,
        alreadyMerged: false,
        fastForward: true,
      })

      const result = await gitCommand.execute([`merge`, `feature`], mockCtx)

      expect(result.stdout).toContain(`Fast-forward`)
    })

    it(`should report already up to date`, async () => {
      mockGit.merge.mockResolvedValue({
        oid: undefined,
        alreadyMerged: true,
        fastForward: false,
      })

      const result = await gitCommand.execute([`merge`, `feature`], mockCtx)

      expect(result.stdout).toContain(`Already up to date`)
    })

    it(`should fail without branch arg`, async () => {
      const result = await gitCommand.execute([`merge`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`must specify a branch`)
    })
  })

  describe(`diff`, () => {
    it(`should show unstaged changes (workdir vs index)`, async () => {
      mockGit.statusMatrix.mockResolvedValue([
        [`untracked.txt`, 0, 2, 0],
        [`mod.txt`, 1, 2, 1],
        [`del.txt`, 1, 0, 1],
        [`staged.txt`, 1, 2, 2],
        [`clean.txt`, 1, 1, 1],
      ])

      const result = await gitCommand.execute([`diff`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`modified: mod.txt`)
      expect(result.stdout).toContain(`deleted:  del.txt`)
      expect(result.stdout).not.toContain(`untracked.txt`)
      expect(result.stdout).not.toContain(`staged.txt`)
      expect(result.stdout).not.toContain(`clean.txt`)
    })

    it(`should return empty for no changes`, async () => {
      mockGit.statusMatrix.mockResolvedValue([[`file.txt`, 1, 1, 1]])

      const result = await gitCommand.execute([`diff`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe(``)
    })
  })

  describe(`rev-parse`, () => {
    it(`should return current branch with --abbrev-ref HEAD`, async () => {
      mockGit.currentBranch.mockResolvedValue(`main`)

      const result = await gitCommand.execute(
        [`rev-parse`, `--abbrev-ref`, `HEAD`],
        mockCtx
      )

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe(`main\n`)
    })

    it(`should return HEAD sha`, async () => {
      mockGit.log.mockResolvedValue([
        {
          oid: `abc123def456`,
          commit: {
            message: `test`,
            tree: ``,
            parent: [],
            author: { name: `A`, email: `a`, timestamp: 0, timezoneOffset: 0 },
            committer: {
              name: `A`,
              email: `a`,
              timestamp: 0,
              timezoneOffset: 0,
            },
          },
          payload: ``,
        },
      ])

      const result = await gitCommand.execute([`rev-parse`, `HEAD`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe(`abc123def456\n`)
    })

    it(`should fail for unknown options`, async () => {
      const result = await gitCommand.execute([`rev-parse`, `--foo`], mockCtx)
      expect(result.exitCode).toBe(1)
    })
  })

  describe(`switch`, () => {
    it(`should switch to existing branch`, async () => {
      mockGit.listBranches.mockResolvedValue([`main`, `develop`])
      mockGit.checkout.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`switch`, `develop`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`Switched to branch 'develop'`)
      expect(mockGit.checkout).toHaveBeenCalledWith(
        expect.objectContaining({ ref: `develop` })
      )
    })

    it(`should create and switch with -c`, async () => {
      mockGit.branch.mockResolvedValue(undefined)
      mockGit.checkout.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`switch`, `-c`, `feature`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`Switched to a new branch 'feature'`)
      expect(mockGit.branch).toHaveBeenCalledWith(
        expect.objectContaining({ ref: `feature` })
      )
    })

    it(`should error on nonexistent branch`, async () => {
      mockGit.listBranches.mockResolvedValue([`main`])

      const result = await gitCommand.execute([`switch`, `nonexistent`], mockCtx)

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`invalid reference`)
    })

    it(`should fail -c without name`, async () => {
      const result = await gitCommand.execute([`switch`, `-c`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`requires a value`)
    })

    it(`should fail without branch ref`, async () => {
      const result = await gitCommand.execute([`switch`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`must specify a branch`)
    })
  })

  describe(`tag`, () => {
    it(`should list tags`, async () => {
      mockGit.listTags.mockResolvedValue([`v1.0`, `v2.0`])

      const result = await gitCommand.execute([`tag`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`v1.0`)
      expect(result.stdout).toContain(`v2.0`)
    })

    it(`should return empty for no tags`, async () => {
      mockGit.listTags.mockResolvedValue([])

      const result = await gitCommand.execute([`tag`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe(``)
    })

    it(`should create lightweight tag`, async () => {
      mockGit.tag.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`tag`, `v1.0`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.tag).toHaveBeenCalledWith(expect.objectContaining({ ref: `v1.0` }))
    })

    it(`should create annotated tag with -a -m`, async () => {
      mockGit.annotatedTag.mockResolvedValue(undefined)

      const result = await gitCommand.execute(
        [`tag`, `-a`, `v1.0`, `-m`, `Release`],
        mockCtx
      )

      expect(result.exitCode).toBe(0)
      expect(mockGit.annotatedTag).toHaveBeenCalledWith(
        expect.objectContaining({
          ref: `v1.0`,
          message: `Release`,
          tagger: { name: `Agent`, email: `agent@tdsk.app` },
        })
      )
    })

    it(`should delete tag with -d`, async () => {
      mockGit.deleteTag.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`tag`, `-d`, `v1.0`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`Deleted tag 'v1.0'`)
      expect(mockGit.deleteTag).toHaveBeenCalledWith(
        expect.objectContaining({ ref: `v1.0` })
      )
    })
  })

  describe(`remote`, () => {
    it(`should list remotes`, async () => {
      mockGit.listRemotes.mockResolvedValue([
        { remote: `origin`, url: `https://example.com/repo.git` },
      ])

      const result = await gitCommand.execute([`remote`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`origin`)
      expect(result.stdout).not.toContain(`https://`)
    })

    it(`should list remotes with -v`, async () => {
      mockGit.listRemotes.mockResolvedValue([
        { remote: `origin`, url: `https://example.com/repo.git` },
      ])

      const result = await gitCommand.execute([`remote`, `-v`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`origin`)
      expect(result.stdout).toContain(`https://example.com/repo.git`)
    })

    it(`should add remote`, async () => {
      mockGit.addRemote.mockResolvedValue(undefined)

      const result = await gitCommand.execute(
        [`remote`, `add`, `origin`, `https://example.com/repo.git`],
        mockCtx
      )

      expect(result.exitCode).toBe(0)
      expect(mockGit.addRemote).toHaveBeenCalledWith(
        expect.objectContaining({
          remote: `origin`,
          url: `https://example.com/repo.git`,
        })
      )
    })

    it(`should remove remote`, async () => {
      mockGit.deleteRemote.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`remote`, `remove`, `origin`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.deleteRemote).toHaveBeenCalledWith(
        expect.objectContaining({ remote: `origin` })
      )
    })

    it(`should return empty for no remotes`, async () => {
      mockGit.listRemotes.mockResolvedValue([])

      const result = await gitCommand.execute([`remote`], mockCtx)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe(``)
    })

    it(`should remove remote with rm alias`, async () => {
      mockGit.deleteRemote.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`remote`, `rm`, `origin`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.deleteRemote).toHaveBeenCalledWith(
        expect.objectContaining({ remote: `origin` })
      )
    })

    it(`should list remotes with --verbose`, async () => {
      mockGit.listRemotes.mockResolvedValue([
        { remote: `origin`, url: `https://example.com/repo.git` },
      ])

      const result = await gitCommand.execute([`remote`, `--verbose`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`origin`)
      expect(result.stdout).toContain(`https://example.com/repo.git`)
    })
  })

  describe(`reset`, () => {
    it(`should unstage a specific file`, async () => {
      mockGit.resetIndex.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`reset`, `file.txt`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.resetIndex).toHaveBeenCalledWith(
        expect.objectContaining({ filepath: `file.txt` })
      )
    })

    it(`should unstage all staged files`, async () => {
      mockGit.statusMatrix.mockResolvedValue([
        [`staged.txt`, 0, 2, 2],
        [`clean.txt`, 1, 1, 1],
        [`also-staged.txt`, 1, 2, 2],
      ])
      mockGit.resetIndex.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`reset`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.resetIndex).toHaveBeenCalledTimes(2)
      expect(mockGit.resetIndex).toHaveBeenCalledWith(
        expect.objectContaining({ filepath: `staged.txt` })
      )
      expect(mockGit.resetIndex).toHaveBeenCalledWith(
        expect.objectContaining({ filepath: `also-staged.txt` })
      )
    })
  })

  describe(`rm`, () => {
    it(`should remove file from index and working tree`, async () => {
      mockGit.remove.mockResolvedValue(undefined)
      mockCtx.fs.rm.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`rm`, `file.txt`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`rm 'file.txt'`)
      expect(mockGit.remove).toHaveBeenCalledWith(
        expect.objectContaining({ filepath: `file.txt` })
      )
      // fs adapter delegates unlink to ctx.fs.rm
      expect(mockCtx.fs.rm).toHaveBeenCalledWith(`/workspace/file.txt`)
    })

    it(`should remove from index only with --cached`, async () => {
      mockGit.remove.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`rm`, `--cached`, `file.txt`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.remove).toHaveBeenCalled()
      expect(mockCtx.fs.rm).not.toHaveBeenCalled()
    })

    it(`should fail without filepath`, async () => {
      const result = await gitCommand.execute([`rm`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`usage:`)
    })

    it(`should tolerate ENOENT when file already deleted`, async () => {
      mockGit.remove.mockResolvedValue(undefined)
      mockCtx.fs.rm.mockRejectedValue(new Error(`ENOENT: no such file or directory`))

      const result = await gitCommand.execute([`rm`, `gone.txt`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`rm 'gone.txt'`)
    })

    it(`should re-throw non-ENOENT errors from unlink`, async () => {
      mockGit.remove.mockResolvedValue(undefined)
      const err: any = new Error(`EACCES: permission denied`)
      err.code = `EACCES`
      mockCtx.fs.rm.mockRejectedValue(err)

      const result = await gitCommand.execute([`rm`, `locked.txt`], mockCtx)

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`EACCES`)
    })
  })

  describe(`show`, () => {
    it(`should show HEAD commit`, async () => {
      mockGit.resolveRef.mockResolvedValue(`abc123def456`)
      mockGit.readCommit.mockResolvedValue({
        oid: `abc123def456`,
        commit: {
          message: `test commit`,
          tree: `tree123`,
          parent: [],
          author: {
            name: `Agent`,
            email: `agent@tdsk.app`,
            timestamp: 1700000000,
            timezoneOffset: 0,
          },
          committer: {
            name: `Agent`,
            email: `agent@tdsk.app`,
            timestamp: 1700000000,
            timezoneOffset: 0,
          },
        },
        payload: ``,
      })

      const result = await gitCommand.execute([`show`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`commit abc123def456`)
      expect(result.stdout).toContain(`Author: Agent <agent@tdsk.app>`)
      expect(result.stdout).toContain(`test commit`)
    })

    it(`should show specific ref`, async () => {
      mockGit.resolveRef.mockResolvedValue(`def789`)
      mockGit.readCommit.mockResolvedValue({
        oid: `def789`,
        commit: {
          message: `another commit`,
          tree: `tree456`,
          parent: [],
          author: {
            name: `Agent`,
            email: `agent@tdsk.app`,
            timestamp: 1700000000,
            timezoneOffset: 0,
          },
          committer: {
            name: `Agent`,
            email: `agent@tdsk.app`,
            timestamp: 1700000000,
            timezoneOffset: 0,
          },
        },
        payload: ``,
      })

      const result = await gitCommand.execute([`show`, `develop`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.resolveRef).toHaveBeenCalledWith(
        expect.objectContaining({ ref: `develop` })
      )
    })
  })

  describe(`cherry-pick`, () => {
    it(`should cherry-pick a commit`, async () => {
      mockGit.cherryPick.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`cherry-pick`, `abc123`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.cherryPick).toHaveBeenCalledWith(
        expect.objectContaining({
          oid: `abc123`,
          committer: { name: `Agent`, email: `agent@tdsk.app` },
        })
      )
    })

    it(`should fail without oid`, async () => {
      const result = await gitCommand.execute([`cherry-pick`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`must specify a commit`)
    })
  })

  describe(`stash`, () => {
    beforeEach(() => {
      mockGit.setConfig.mockResolvedValue(undefined)
    })

    it(`should stash push`, async () => {
      mockGit.stash.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`stash`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`Saved working directory`)
      expect(mockGit.stash).toHaveBeenCalledWith(expect.objectContaining({ op: `push` }))
    })

    it(`should stash push with message`, async () => {
      mockGit.stash.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`stash`, `push`, `-m`, `wip`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.stash).toHaveBeenCalledWith(
        expect.objectContaining({ op: `push`, message: `wip` })
      )
    })

    it(`should stash pop`, async () => {
      mockGit.stash.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`stash`, `pop`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.stash).toHaveBeenCalledWith(expect.objectContaining({ op: `pop` }))
    })

    it(`should stash apply`, async () => {
      mockGit.stash.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`stash`, `apply`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.stash).toHaveBeenCalledWith(expect.objectContaining({ op: `apply` }))
    })

    it(`should stash drop`, async () => {
      mockGit.stash.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`stash`, `drop`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.stash).toHaveBeenCalledWith(expect.objectContaining({ op: `drop` }))
    })

    it(`should stash list`, async () => {
      mockGit.stash.mockResolvedValue(`stash@{0}: WIP`)

      const result = await gitCommand.execute([`stash`, `list`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`stash@{0}: WIP`)
    })

    it(`should return empty string for empty stash list`, async () => {
      mockGit.stash.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`stash`, `list`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe(``)
    })

    it(`should stash clear`, async () => {
      mockGit.stash.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`stash`, `clear`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.stash).toHaveBeenCalledWith(expect.objectContaining({ op: `clear` }))
    })

    it(`should error on unknown stash subcommand`, async () => {
      const result = await gitCommand.execute([`stash`, `bogus`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`unknown stash subcommand`)
    })
  })

  describe(`clone`, () => {
    it(`should clone a repo`, async () => {
      mockGit.clone.mockResolvedValue(undefined)

      const result = await gitCommand.execute(
        [`clone`, `https://example.com/repo.git`],
        mockCtx
      )

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`Cloning into`)
      expect(mockGit.clone).toHaveBeenCalledWith(
        expect.objectContaining({ url: `https://example.com/repo.git` })
      )
    })

    it(`should support --depth`, async () => {
      mockGit.clone.mockResolvedValue(undefined)

      await gitCommand.execute(
        [`clone`, `https://example.com/repo.git`, `--depth`, `1`],
        mockCtx
      )

      expect(mockGit.clone).toHaveBeenCalledWith(expect.objectContaining({ depth: 1 }))
    })

    it(`should support --branch`, async () => {
      mockGit.clone.mockResolvedValue(undefined)

      await gitCommand.execute(
        [`clone`, `https://example.com/repo.git`, `--branch`, `develop`],
        mockCtx
      )

      expect(mockGit.clone).toHaveBeenCalledWith(
        expect.objectContaining({ ref: `develop` })
      )
    })

    it(`should pass target directory when provided`, async () => {
      mockGit.clone.mockResolvedValue(undefined)

      const result = await gitCommand.execute(
        [`clone`, `https://example.com/repo.git`, `/target`],
        mockCtx
      )

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`Cloning into '/target'`)
      expect(mockGit.clone).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `https://example.com/repo.git`,
          dir: `/target`,
        })
      )
    })

    it(`should fail without URL`, async () => {
      const result = await gitCommand.execute([`clone`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`must specify a repository`)
    })
  })

  describe(`fetch`, () => {
    it(`should fetch from remote`, async () => {
      mockGit.fetch.mockResolvedValue({} as any)

      const result = await gitCommand.execute([`fetch`, `origin`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.fetch).toHaveBeenCalledWith(
        expect.objectContaining({ remote: `origin` })
      )
    })

    it(`should support --prune`, async () => {
      mockGit.fetch.mockResolvedValue({} as any)

      await gitCommand.execute([`fetch`, `origin`, `--prune`], mockCtx)

      expect(mockGit.fetch).toHaveBeenCalledWith(expect.objectContaining({ prune: true }))
    })

    it(`should fail without remote`, async () => {
      const result = await gitCommand.execute([`fetch`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`No remote repository`)
    })
  })

  describe(`pull`, () => {
    it(`should pull from remote`, async () => {
      mockGit.pull.mockResolvedValue(undefined)

      const result = await gitCommand.execute([`pull`, `origin`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.pull).toHaveBeenCalledWith(
        expect.objectContaining({
          remote: `origin`,
          author: { name: `Agent`, email: `agent@tdsk.app` },
        })
      )
    })

    it(`should support --ff-only`, async () => {
      mockGit.pull.mockResolvedValue(undefined)

      await gitCommand.execute([`pull`, `origin`, `--ff-only`], mockCtx)

      expect(mockGit.pull).toHaveBeenCalledWith(
        expect.objectContaining({ fastForwardOnly: true })
      )
    })

    it(`should fail without remote`, async () => {
      const result = await gitCommand.execute([`pull`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`No remote repository`)
    })
  })

  describe(`push`, () => {
    it(`should push to remote`, async () => {
      mockGit.push.mockResolvedValue({} as any)

      const result = await gitCommand.execute([`push`, `origin`], mockCtx)

      expect(result.exitCode).toBe(0)
      expect(mockGit.push).toHaveBeenCalledWith(
        expect.objectContaining({ remote: `origin` })
      )
    })

    it(`should support --force`, async () => {
      mockGit.push.mockResolvedValue({} as any)

      await gitCommand.execute([`push`, `origin`, `main`, `--force`], mockCtx)

      expect(mockGit.push).toHaveBeenCalledWith(
        expect.objectContaining({ remote: `origin`, ref: `main`, force: true })
      )
    })

    it(`should support -f`, async () => {
      mockGit.push.mockResolvedValue({} as any)

      await gitCommand.execute([`push`, `origin`, `-f`], mockCtx)

      expect(mockGit.push).toHaveBeenCalledWith(expect.objectContaining({ force: true }))
    })

    it(`should fail without remote`, async () => {
      const result = await gitCommand.execute([`push`], mockCtx)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`No remote repository`)
    })
  })

  describe(`error handling`, () => {
    it(`should catch and return isomorphic-git errors`, async () => {
      mockGit.init.mockRejectedValue(new Error(`Something went wrong`))

      const result = await gitCommand.execute([`init`], mockCtx)

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`Something went wrong`)
    })

    it(`should include error code when present`, async () => {
      const err: any = new Error(`branch 'foo' not found`)
      err.code = `NotFoundError`
      mockGit.checkout.mockRejectedValue(err)

      const result = await gitCommand.execute([`checkout`, `foo`], mockCtx)

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`[NotFoundError]`)
      expect(result.stderr).toContain(`branch 'foo' not found`)
    })
  })
})
