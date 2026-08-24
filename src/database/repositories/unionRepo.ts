// ---------------------------------------------------------------------------
// Repository des unions : partenaires multiples + enfants rattachés à l'union,
// et liens directs parent -> enfant (adoption / parent inconnu / parent seul).
// ---------------------------------------------------------------------------
import { exec, query, transaction } from '@/database/client'
import type {
  UnionFamily, UnionView, DateValue, RelationshipType, ParentLink, ChildLink,
} from '@/types'
import { buildDateValue, uid, type DateInput } from '@/lib/dates'
import { getPeopleByIds } from './personRepo'

export interface UnionInput {
  type: UnionFamily['type']
  status: UnionFamily['status']
  place: string
  notes?: string
  start?: { date?: DateInput }
  end?: { date?: DateInput }
  partner_ids: string[]
  children?: { child_id: string; relationship_type: RelationshipType }[]
}

function mapUnion(r: Record<string, unknown>): UnionFamily {
  return {
    id: String(r.id ?? ''),
    type: (r.type as UnionFamily['type']) ?? 'union',
    status: (r.status as UnionFamily['status']) ?? 'actuel',
    start_date_id: r.start_date_id ? String(r.start_date_id) : null,
    end_date_id: r.end_date_id ? String(r.end_date_id) : null,
    place: String(r.place ?? ''),
    notes: String(r.notes ?? ''),
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
    deleted_at: r.deleted_at ? String(r.deleted_at) : null,
  }
}

export async function createUnion(projectId: string, input: UnionInput): Promise<string> {
  const id = uid()
  const start = input.start?.date ? buildDateValue(input.start.date) : null
  const end = input.end?.date ? buildDateValue(input.end.date) : null
  const now = new Date().toISOString()
  const children = input.children ?? []

  const stmts: { sql: string; params: unknown[] }[] = []
  // Les date_value doivent exister AVANT d'être référencées par union_family (FK).
  if (start) {
    stmts.push({ sql: 'INSERT INTO date_value(id, qualifier, d1, d2, sort_key, label) VALUES(?1,?2,?3,?4,?5,?6)', params: [start.id, start.qualifier, start.d1, start.d2, start.sort_key, start.label] })
  }
  if (end) {
    stmts.push({ sql: 'INSERT INTO date_value(id, qualifier, d1, d2, sort_key, label) VALUES(?1,?2,?3,?4,?5,?6)', params: [end.id, end.qualifier, end.d1, end.d2, end.sort_key, end.label] })
  }
  stmts.push({
    sql: `INSERT INTO union_family(id, type, status, start_date_id, end_date_id, place, notes, created_at, updated_at)
          VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)`,
    params: [id, input.type, input.status, start?.id ?? null, end?.id ?? null, input.place.trim(), (input.notes ?? '').trim(), now, now],
  })
  for (const pid of input.partner_ids) {
    stmts.push({ sql: 'INSERT INTO union_partner(union_id, person_id, role) VALUES(?1,?2,?)', params: [id, pid, input.partner_ids.indexOf(pid) === 0 ? 'principal' : ''] })
  }
  for (const c of children) {
    stmts.push({ sql: 'INSERT INTO union_child(union_id, child_id, relationship_type) VALUES(?1,?2,?3)', params: [id, c.child_id, c.relationship_type] })
  }
  await transaction(projectId, stmts)
  return id
}

export async function updateUnion(projectId: string, id: string, input: UnionInput): Promise<void> {
  const start = input.start?.date ? buildDateValue(input.start.date) : null
  const end = input.end?.date ? buildDateValue(input.end.date) : null
  const now = new Date().toISOString()
  const children = input.children ?? []

  const stmts: { sql: string; params: unknown[] }[] = []
  // date_value d'abord (FK) puis mise à jour de l'union + réinscription des liens.
  if (start) {
    stmts.push({ sql: 'INSERT INTO date_value(id, qualifier, d1, d2, sort_key, label) VALUES(?1,?2,?3,?4,?5,?6)', params: [start.id, start.qualifier, start.d1, start.d2, start.sort_key, start.label] })
  }
  if (end) {
    stmts.push({ sql: 'INSERT INTO date_value(id, qualifier, d1, d2, sort_key, label) VALUES(?1,?2,?3,?4,?5,?6)', params: [end.id, end.qualifier, end.d1, end.d2, end.sort_key, end.label] })
  }
  stmts.push({
    sql: `UPDATE union_family SET type=?2, status=?3, place=?4, notes=?5, updated_at=?6,
          start_date_id=?7, end_date_id=?8 WHERE id=?1`,
    params: [id, input.type, input.status, input.place.trim(), (input.notes ?? '').trim(), now, start?.id ?? null, end?.id ?? null],
  })
  stmts.push({ sql: 'DELETE FROM union_partner WHERE union_id=?1', params: [id] })
  stmts.push({ sql: 'DELETE FROM union_child WHERE union_id=?1', params: [id] })
  for (const pid of input.partner_ids) {
    stmts.push({ sql: 'INSERT INTO union_partner(union_id, person_id, role) VALUES(?1,?2,?)', params: [id, pid, input.partner_ids.indexOf(pid) === 0 ? 'principal' : ''] })
  }
  for (const c of children) {
    stmts.push({ sql: 'INSERT INTO union_child(union_id, child_id, relationship_type) VALUES(?1,?2,?3)', params: [id, c.child_id, c.relationship_type] })
  }
  await transaction(projectId, stmts)
}

export async function addUnionPartner(projectId: string, unionId: string, personId: string): Promise<void> {
  await exec(projectId, 'INSERT OR IGNORE INTO union_partner(union_id, person_id) VALUES(?1,?2)', [unionId, personId])
  await exec(projectId, "UPDATE union_family SET updated_at=datetime('now') WHERE id=?1", [unionId])
}

export async function removeUnionPartner(projectId: string, unionId: string, personId: string): Promise<void> {
  await exec(projectId, 'DELETE FROM union_partner WHERE union_id=?1 AND person_id=?2', [unionId, personId])
}

export async function addUnionChild(projectId: string, unionId: string, childId: string, rel: RelationshipType = 'biologique'): Promise<void> {
  await exec(projectId, 'INSERT OR IGNORE INTO union_child(union_id, child_id, relationship_type) VALUES(?1,?2,?3)', [unionId, childId, rel])
}

export async function setChildType(projectId: string, unionId: string, childId: string, rel: RelationshipType): Promise<void> {
  await exec(projectId, 'UPDATE union_child SET relationship_type=?3 WHERE union_id=?1 AND child_id=?2', [unionId, childId, rel])
}

export async function removeUnionChild(projectId: string, unionId: string, childId: string): Promise<void> {
  await exec(projectId, 'DELETE FROM union_child WHERE union_id=?1 AND child_id=?2', [unionId, childId])
  await exec(projectId, 'DELETE FROM parent_child WHERE child_id=?2 AND parent_id IN (SELECT person_id FROM union_partner WHERE union_id=?1)', [unionId, childId])
}

export async function addParentLink(projectId: string, parentId: string, childId: string, rel: RelationshipType = 'biologique', note = ''): Promise<void> {
  await exec(projectId, 'INSERT OR IGNORE INTO parent_child(parent_id, child_id, relationship_type, note) VALUES(?1,?2,?3,?4)', [parentId, childId, rel, note])
}

export async function removeParentLink(projectId: string, parentId: string, childId: string): Promise<void> {
  await exec(projectId, 'DELETE FROM parent_child WHERE parent_id=?1 AND child_id=?2', [parentId, childId])
}

export async function softDeleteUnion(projectId: string, unionId: string): Promise<void> {
  await exec(projectId, "UPDATE union_family SET deleted_at=datetime('now'), updated_at=datetime('now') WHERE id=?1", [unionId])
}

function mapDate(r: Record<string, unknown>): DateValue | null {
  const q = r.qualifier
  if (q === null || q === undefined || String(q) === '') return null
  return {
    id: String(r.id),
    qualifier: q as DateValue['qualifier'],
    d1: String(r.d1 ?? ''),
    d2: String(r.d2 ?? ''),
    sort_key: (r.sort_key as number | null) ?? null,
    label: String(r.label ?? ''),
  }
}

/** Union complète avec dates, partenaires et enfants (personnes). */
export async function getUnion(projectId: string, unionId: string): Promise<UnionView | null> {
  const unions = await query<Record<string, unknown>>(
    projectId,
    'SELECT * FROM union_family WHERE id=?1', [unionId],
  )
  if (!unions.length) return null
  return buildUnionView(projectId, mapUnion(unions[0]))
}

async function buildUnionView(projectId: string, union: UnionFamily): Promise<UnionView> {
  const [startRows, endRows, partnerRows, childRows] = await Promise.all([
    union.start_date_id ? query<Record<string, unknown>>(projectId, 'SELECT * FROM date_value WHERE id=?1', [union.start_date_id]) : Promise.resolve([]),
    union.end_date_id ? query<Record<string, unknown>>(projectId, 'SELECT * FROM date_value WHERE id=?1', [union.end_date_id]) : Promise.resolve([]),
    query<{ person_id: string }>(projectId, 'SELECT person_id FROM union_partner WHERE union_id=?1', [unionId(union)]),
    query<{ child_id: string; relationship_type: RelationshipType }>(projectId, 'SELECT child_id, relationship_type FROM union_child WHERE union_id=?1', [unionId(union)]),
  ])

  const partnerIds = partnerRows.map((r) => r.person_id)
  const childIds = childRows.map((r) => r.child_id)
  const [partners, children] = await Promise.all([
    getPeopleByIds(projectId, partnerIds),
    getPeopleByIds(projectId, childIds),
  ])
  const byId = new Map(children.map((c) => [c.id, c]))

  return {
    union,
    start: startRows.length ? mapDate(startRows[0]) : null,
    end: endRows.length ? mapDate(endRows[0]) : null,
    partners,
    children: childRows.map((r) => ({
      person: byId.get(r.child_id)!,
      relationship_type: r.relationship_type,
    })),
  }
}

function unionId(u: UnionFamily): string {
  return u.id
}

/** Toutes les unions (non supprimées) où cette personne est partenaire. */
export async function listPersonUnions(projectId: string, personId: string): Promise<UnionView[]> {
  const rows = await query<Record<string, unknown>>(
    projectId,
    `SELECT u.* FROM union_family u
     JOIN union_partner up ON up.union_id = u.id
     WHERE up.person_id=?1 AND u.deleted_at IS NULL
     ORDER BY u.created_at`,
    [personId],
  )
  return Promise.all(rows.map((r) => buildUnionView(projectId, mapUnion(r))))
}

export async function listAllUnions(projectId: string): Promise<UnionFamily[]> {
  const rows = await query<Record<string, unknown>>(
    projectId,
    'SELECT * FROM union_family WHERE deleted_at IS NULL ORDER BY created_at',
  )
  return rows.map(mapUnion)
}

/** Toutes les unions complètes (dates, partenaires, enfants) — vie de l'arbre. */
export async function listAllUnionViews(projectId: string): Promise<UnionView[]> {
  const rows = await query<Record<string, unknown>>(
    projectId,
    'SELECT * FROM union_family WHERE deleted_at IS NULL ORDER BY created_at DESC',
  )
  return Promise.all(rows.map((r) => buildUnionView(projectId, mapUnion(r))))
}

/** Liens directs parent->enfant (toutes relations). */
export async function listParentLinks(projectId: string): Promise<ParentLink[]> {
  const rows = await query<Record<string, unknown>>(projectId, 'SELECT * FROM parent_child')
  return rows.map((r) => ({
    parent_id: String(r.parent_id),
    child_id: String(r.child_id),
    relationship_type: (r.relationship_type as RelationshipType) ?? 'biologique',
    note: String(r.note ?? ''),
  }))
}

export async function listChildLinks(projectId: string): Promise<ChildLink[]> {
  const rows = await query<Record<string, unknown>>(projectId, 'SELECT * FROM union_child')
  return rows.map((r) => ({
    union_id: String(r.union_id),
    child_id: String(r.child_id),
    relationship_type: (r.relationship_type as RelationshipType) ?? 'biologique',
  }))
}

export interface UnionPartnerRow {
  union_id: string
  person_id: string
}

export async function listAllUnionPartners(projectId: string): Promise<UnionPartnerRow[]> {
  const rows = await query<Record<string, unknown>>(projectId, 'SELECT union_id, person_id FROM union_partner')
  return rows.map((r) => ({ union_id: String(r.union_id), person_id: String(r.person_id) }))
}

export async function listUnionPartners(projectId: string, unionId: string): Promise<string[]> {
  const rows = await query<{ person_id: string }>(
    projectId,
    'SELECT person_id FROM union_partner WHERE union_id=?1',
    [unionId],
  )
  return rows.map((r) => r.person_id)
}