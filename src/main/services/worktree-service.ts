import { execSync } from 'child_process'
import { join, basename, dirname } from 'path'
import { existsSync } from 'fs'

export class WorktreeService {
  /**
   * Create a git worktree for a new branch.
   * Worktrees are placed in <repoParent>/.worktrees/<repoName>-<branch>
   */
  createWorktree(repoRoot: string, branchName: string, baseBranch?: string): string {
    const repoName = basename(repoRoot)
    const safeBranch = branchName.replace(/\//g, '-')
    const worktreeDir = join(dirname(repoRoot), '.worktrees', `${repoName}-${safeBranch}`)

    // Check if branch already exists
    const branchExists = this.branchExists(repoRoot, branchName)

    if (branchExists) {
      // Use existing branch
      execSync(`git worktree add "${worktreeDir}" "${branchName}"`, {
        cwd: repoRoot,
        encoding: 'utf-8',
        timeout: 15000
      })
    } else {
      // Create new branch from base
      const base = baseBranch || 'HEAD'
      execSync(`git worktree add -b "${branchName}" "${worktreeDir}" "${base}"`, {
        cwd: repoRoot,
        encoding: 'utf-8',
        timeout: 15000
      })
    }

    return worktreeDir
  }

  /**
   * Remove a worktree and optionally delete the branch.
   */
  removeWorktree(repoRoot: string, worktreePath: string, deleteBranch: boolean): void {
    // Get branch name before removing
    let branchName: string | null = null
    if (deleteBranch) {
      branchName = this.getBranchForWorktree(worktreePath)
    }

    try {
      execSync(`git worktree remove "${worktreePath}" --force`, {
        cwd: repoRoot,
        encoding: 'utf-8',
        timeout: 15000
      })
    } catch {
      // If remove fails, try prune
      if (existsSync(worktreePath)) throw new Error(`Failed to remove worktree at ${worktreePath}`)
      execSync('git worktree prune', { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 })
    }

    if (deleteBranch && branchName) {
      try {
        execSync(`git branch -D "${branchName}"`, {
          cwd: repoRoot,
          encoding: 'utf-8',
          timeout: 5000
        })
      } catch {
        // Branch might already be deleted or is current branch
      }
    }
  }

  /**
   * List local branches for a repo.
   */
  listBranches(repoRoot: string): string[] {
    try {
      const output = execSync('git branch --list --format="%(refname:short)"', {
        cwd: repoRoot,
        encoding: 'utf-8',
        timeout: 5000
      }).trim()
      if (!output) return []
      return output.split('\n').map((b) => b.trim()).filter(Boolean)
    } catch {
      return []
    }
  }

  /**
   * Get current branch for a directory.
   */
  getCurrentBranch(cwd: string): string | null {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', {
        cwd,
        encoding: 'utf-8',
        timeout: 3000
      }).trim()
    } catch {
      return null
    }
  }

  /**
   * Get repo root from any subdirectory.
   */
  getRepoRoot(cwd: string): string | null {
    try {
      return execSync('git rev-parse --show-toplevel', {
        cwd,
        encoding: 'utf-8',
        timeout: 3000
      }).trim()
    } catch {
      return null
    }
  }

  private branchExists(repoRoot: string, branchName: string): boolean {
    try {
      execSync(`git rev-parse --verify "${branchName}"`, {
        cwd: repoRoot,
        encoding: 'utf-8',
        timeout: 3000,
        stdio: 'pipe'
      })
      return true
    } catch {
      return false
    }
  }

  private getBranchForWorktree(worktreePath: string): string | null {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: worktreePath,
        encoding: 'utf-8',
        timeout: 3000
      }).trim()
    } catch {
      return null
    }
  }
}
