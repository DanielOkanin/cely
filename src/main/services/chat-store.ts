import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { homedir } from 'os'
import type { TerminalSession, Feature } from '../types'
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from '../types'
import type { AgentProviderId } from '../providers/types'
import { inferProvider, getProvider } from '../providers'

const DB_DIR = join(homedir(), '.cely')
const DB_PATH = join(DB_DIR, 'terminals.db')

export class ChatStore {
  private db: Database.Database

  constructor() {
    mkdirSync(DB_DIR, { recursive: true })
    this.db = new Database(DB_PATH)
    this.db.pragma('journal_mode = WAL')
    this.init()
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS terminal_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        working_directory TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT '${DEFAULT_MODEL}',
        session_id TEXT
      );
    `)

    // Migration: add model column if missing
    const columns = this.db.prepare("PRAGMA table_info(terminal_sessions)").all() as { name: string }[]
    if (!columns.some((c) => c.name === 'model')) {
      this.db.exec(`ALTER TABLE terminal_sessions ADD COLUMN model TEXT NOT NULL DEFAULT '${DEFAULT_MODEL}'`)
    }
    // Migration: add session_id column if missing
    if (!columns.some((c) => c.name === 'session_id')) {
      this.db.exec(`ALTER TABLE terminal_sessions ADD COLUMN session_id TEXT`)
    }
    // Migration: add provider column if missing
    if (!columns.some((c) => c.name === 'provider')) {
      this.db.exec(`ALTER TABLE terminal_sessions ADD COLUMN provider TEXT NOT NULL DEFAULT 'claude'`)
    }
    // Migration: add worktree columns if missing
    if (!columns.some((c) => c.name === 'worktree_path')) {
      this.db.exec(`ALTER TABLE terminal_sessions ADD COLUMN worktree_path TEXT`)
    }
    if (!columns.some((c) => c.name === 'source_directory')) {
      this.db.exec(`ALTER TABLE terminal_sessions ADD COLUMN source_directory TEXT`)
    }
    // Migration: add feature_id column if missing
    if (!columns.some((c) => c.name === 'feature_id')) {
      this.db.exec(`ALTER TABLE terminal_sessions ADD COLUMN feature_id TEXT`)
    }

    // Pinned projects table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pinned_projects (
        id TEXT PRIMARY KEY,
        directory TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `)

    // Features table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS features (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        directory TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `)
  }

  createChat(workingDirectory: string, model?: string, provider?: AgentProviderId, worktreePath?: string, sourceDirectory?: string, featureId?: string): TerminalSession {
    const id = uuidv4()
    const now = Date.now()
    const dirName = workingDirectory.split('/').pop() || 'terminal'
    const title = dirName
    // Infer provider from model, or default to claude
    const p: AgentProviderId = provider || (model ? inferProvider(model).id : DEFAULT_PROVIDER)
    // Use provider's own default model if none specified
    const providerConfig = getProvider(p)
    const m = model || providerConfig.defaultModel

    this.db
      .prepare(
        `INSERT INTO terminal_sessions (id, title, created_at, updated_at, working_directory, model, provider, worktree_path, source_directory, feature_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, title, now, now, workingDirectory, m, p, worktreePath || null, sourceDirectory || null, featureId || null)

    return { id, title, createdAt: now, updatedAt: now, workingDirectory, model: m, sessionId: id, provider: p, worktreePath: worktreePath || null, sourceDirectory: sourceDirectory || null, featureId: featureId || null }
  }

  listChats(): TerminalSession[] {
    const rows = this.db
      .prepare('SELECT * FROM terminal_sessions ORDER BY updated_at DESC')
      .all() as Array<{
      id: string
      title: string
      created_at: number
      updated_at: number
      working_directory: string
      model: string
      session_id: string | null
      provider: string | null
      worktree_path: string | null
      source_directory: string | null
      feature_id: string | null
    }>

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      workingDirectory: row.working_directory,
      model: row.model || DEFAULT_MODEL,
      sessionId: row.session_id || row.id,
      provider: (row.provider as AgentProviderId) || DEFAULT_PROVIDER,
      worktreePath: row.worktree_path || null,
      sourceDirectory: row.source_directory || null,
      featureId: row.feature_id || null
    }))
  }

  deleteChat(id: string): void {
    this.db.prepare('DELETE FROM terminal_sessions WHERE id = ?').run(id)
  }

  updateTitle(id: string, title: string): void {
    this.db.prepare('UPDATE terminal_sessions SET title = ?, updated_at = ? WHERE id = ?').run(title, Date.now(), id)
  }

  getChat(id: string): TerminalSession | null {
    const row = this.db.prepare('SELECT * FROM terminal_sessions WHERE id = ?').get(id) as any
    if (!row) return null
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      workingDirectory: row.working_directory,
      model: row.model || DEFAULT_MODEL,
      sessionId: row.session_id || row.id,
      provider: (row.provider as AgentProviderId) || DEFAULT_PROVIDER,
      worktreePath: row.worktree_path || null,
      sourceDirectory: row.source_directory || null,
      featureId: row.feature_id || null
    }
  }

  getSessionsByFeatureId(featureId: string): TerminalSession[] {
    const rows = this.db
      .prepare('SELECT * FROM terminal_sessions WHERE feature_id = ?')
      .all(featureId) as any[]
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      workingDirectory: row.working_directory,
      model: row.model || DEFAULT_MODEL,
      sessionId: row.session_id || row.id,
      provider: (row.provider as AgentProviderId) || DEFAULT_PROVIDER,
      worktreePath: row.worktree_path || null,
      sourceDirectory: row.source_directory || null,
      featureId: row.feature_id || null
    }))
  }

  getSessionsByWorktreePath(worktreePath: string): TerminalSession[] {
    const rows = this.db
      .prepare('SELECT * FROM terminal_sessions WHERE worktree_path = ?')
      .all(worktreePath) as any[]
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      workingDirectory: row.working_directory,
      model: row.model || DEFAULT_MODEL,
      sessionId: row.session_id || row.id,
      provider: (row.provider as AgentProviderId) || DEFAULT_PROVIDER,
      worktreePath: row.worktree_path || null,
      sourceDirectory: row.source_directory || null,
      featureId: row.feature_id || null
    }))
  }

  updateSessionId(id: string, sessionId: string): void {
    this.db.prepare('UPDATE terminal_sessions SET session_id = ?, updated_at = ? WHERE id = ?').run(sessionId, Date.now(), id)
  }

  // --- Feature CRUD ---

  createFeature(name: string, directory: string): Feature {
    const id = uuidv4()
    const now = Date.now()
    this.db
      .prepare('INSERT INTO features (id, name, directory, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, directory, now, now)
    return { id, name, directory, createdAt: now, updatedAt: now }
  }

  listFeatures(): Feature[] {
    const rows = this.db
      .prepare('SELECT * FROM features ORDER BY updated_at DESC')
      .all() as any[]
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      directory: row.directory,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  }

  getFeature(id: string): Feature | null {
    const row = this.db.prepare('SELECT * FROM features WHERE id = ?').get(id) as any
    if (!row) return null
    return { id: row.id, name: row.name, directory: row.directory, createdAt: row.created_at, updatedAt: row.updated_at }
  }

  renameFeature(id: string, name: string): void {
    this.db.prepare('UPDATE features SET name = ?, updated_at = ? WHERE id = ?').run(name, Date.now(), id)
  }

  deleteFeature(id: string): void {
    this.db.prepare('DELETE FROM features WHERE id = ?').run(id)
  }

  // --- Pinned Projects ---

  pinProject(directory: string, name?: string): { id: string; directory: string; name: string; createdAt: number } {
    const id = uuidv4()
    const now = Date.now()
    const displayName = name || directory.split('/').pop() || directory
    this.db
      .prepare('INSERT OR IGNORE INTO pinned_projects (id, directory, name, created_at) VALUES (?, ?, ?, ?)')
      .run(id, directory, displayName, now)
    return { id, directory, name: displayName, createdAt: now }
  }

  unpinProject(id: string): void {
    this.db.prepare('DELETE FROM pinned_projects WHERE id = ?').run(id)
  }

  unpinProjectByDir(directory: string): void {
    this.db.prepare('DELETE FROM pinned_projects WHERE directory = ?').run(directory)
  }

  listPinnedProjects(): { id: string; directory: string; name: string; createdAt: number }[] {
    const rows = this.db
      .prepare('SELECT * FROM pinned_projects ORDER BY created_at ASC')
      .all() as any[]
    return rows.map((r) => ({ id: r.id, directory: r.directory, name: r.name, createdAt: r.created_at }))
  }

  isPinned(directory: string): boolean {
    const row = this.db.prepare('SELECT id FROM pinned_projects WHERE directory = ?').get(directory)
    return !!row
  }

  getRecentDirectories(limit: number = 10): string[] {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT working_directory, MAX(updated_at) as last_used
         FROM terminal_sessions
         GROUP BY working_directory
         ORDER BY last_used DESC
         LIMIT ?`
      )
      .all(limit) as { working_directory: string }[]
    return rows.map((r) => r.working_directory)
  }
}
