// ---------------------------------------------------------------------------
// Client d'accès aux données — pont paramétré vers SQLite (via Tauri).
// Aucune requête ne concatène de valeurs : tout passe par des paramètres liés.
// ---------------------------------------------------------------------------
import { invoke } from '@tauri-apps/api/core'

export const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export class DbError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DbError'
  }
}

function requireTauri() {
  if (!isTauri) {
    throw new DbError(
      "STEMMA doit être lancé via l'application de bureau (Tauri). " +
        'Aucune donnée ne quitte cet ordinateur.',
    )
  }
}

function err(e: unknown): never {
  const msg = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e)
  throw new DbError(msg)
}

export interface ExecResult {
  last_insert_id: number | null
  rows_affected: number
}

export interface Statement {
  sql: string
  params?: unknown[]
}

export function isExecResult(v: unknown): v is ExecResult {
  return typeof v === 'object' && v !== null && 'rows_affected' in v
}

/** Exécute un INSERT/UPDATE/DELETE paramétré. */
export async function exec(projectId: string, sql: string, params: unknown[] = []): Promise<ExecResult> {
  requireTauri()
  const res = await invoke('db_exec', { projectId, sql, params }).catch(err)
  if (isExecResult(res)) return res
  return { last_insert_id: null, rows_affected: 0 }
}

/** Exécute une lecture paramétrée. */
export async function query<T = Record<string, unknown>>(
  projectId: string,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  requireTauri()
  const rows = await invoke('db_query', { projectId, sql, params }).catch(err)
  if (Array.isArray(rows)) return rows as T[]
  throw new DbError('réponse inattendue du moteur SQL')
}

/** Exécute une liste d'écritures atomiquement (tout ou rien). */
export async function transaction(
  projectId: string,
  statements: Statement[],
): Promise<unknown[]> {
  requireTauri()
  const res = await invoke('db_transaction', { projectId, statements }).catch(err)
  if (Array.isArray(res)) return res
  throw new DbError('transaction invalide')
}

/** Vérifie l'intégrité de la base du projet. */
export async function integrityCheck(projectId: string): Promise<{ ok: boolean; details: string[] }> {
  requireTauri()
  const res = await invoke('integrity_check', { projectId }).catch(err)
  return res as { ok: boolean; details: string[] }
}