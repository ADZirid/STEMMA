// ---------------------------------------------------------------------------
// Sources : CRUD simple (les sources sont des références bibliographiques).
// ---------------------------------------------------------------------------
import { exec, query, transaction } from '@/database/client'
import type { Source } from '@/types'
import { uid } from '@/lib/dates'

export interface SourceInput {
  title: string
  author: string
  date: string
  archive: string
  reference: string
  url: string
  comment: string
}

function mapRow(r: Record<string, unknown>): Source {
  return {
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    author: String(r.author ?? ''),
    date: String(r.date ?? ''),
    archive: String(r.archive ?? ''),
    reference: String(r.reference ?? ''),
    url: String(r.url ?? ''),
    comment: String(r.comment ?? ''),
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

export async function createSource(projectId: string, input: SourceInput): Promise<string> {
  const id = uid()
  const now = new Date().toISOString()
  await exec(
    projectId,
    `INSERT INTO source(id, title, author, date, archive, reference, url, comment, created_at, updated_at)
     VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`,
    [id, input.title.trim(), input.author.trim(), input.date.trim(), input.archive.trim(), input.reference.trim(), input.url.trim(), input.comment.trim(), now, now],
  )
  return id
}

export async function updateSource(projectId: string, id: string, input: SourceInput): Promise<void> {
  const now = new Date().toISOString()
  await exec(
    projectId,
    `UPDATE source SET title=?2, author=?3, date=?4, archive=?5, reference=?6, url=?7, comment=?8, updated_at=?9 WHERE id=?1`,
    [id, input.title.trim(), input.author.trim(), input.date.trim(), input.archive.trim(), input.reference.trim(), input.url.trim(), input.comment.trim(), now],
  )
}

export async function listSources(projectId: string): Promise<Source[]> {
  const rows = await query<Record<string, unknown>>(
    projectId,
    'SELECT * FROM source ORDER BY title COLLATE NOCASE',
  )
  return rows.map(mapRow)
}

export async function deleteSource(projectId: string, id: string): Promise<void> {
  await exec(projectId, 'DELETE FROM source WHERE id=?1', [id])
}

export interface CitationInput {
  source_id: string
  person_id?: string
  union_id?: string
  media_id?: string
  quote: string
  page: string
}

/** Lien source -> entité (personne, union, média) via la table `citation`. */
export async function addCitation(projectId: string, input: CitationInput): Promise<void> {
  const entities: { entity_type: string; entity_id: string }[] = []
  if (input.person_id) entities.push({ entity_type: 'person', entity_id: input.person_id })
  if (input.union_id) entities.push({ entity_type: 'union', entity_id: input.union_id })
  if (input.media_id) entities.push({ entity_type: 'media', entity_id: input.media_id })
  if (!entities.length) return
  const detail = [input.quote, input.page].filter(Boolean).join(' · ')
  await transaction(
    projectId,
    entities.map((e) => ({
      sql: 'INSERT INTO citation(id, source_id, entity_type, entity_id, detail) VALUES(?1,?2,?3,?4,?5)',
      params: [uid(), input.source_id, e.entity_type, e.entity_id, detail],
    })),
  )
}