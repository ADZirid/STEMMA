// ---------------------------------------------------------------------------
// Repository des événements CRUD — naissances, mariages, décès, etc.
// ---------------------------------------------------------------------------
import { query, transaction } from '@/database/client'
import type { GeneEvent, GeneEventView, DateValue, EventType } from '@/types'
import { buildDateValue, uid, type DateInput } from '@/lib/dates'

export interface EventInput {
  person_id?: string | null
  union_id?: string | null
  type: EventType
  type_label?: string
  date?: DateInput | null
  place?: string
  description?: string
}

function mapEvent(r: Record<string, unknown>): GeneEvent {
  return {
    id: String(r.id ?? ''),
    person_id: r.person_id ? String(r.person_id) : null,
    union_id: r.union_id ? String(r.union_id) : null,
    type: (r.type as EventType) ?? 'personnalise',
    type_label: String(r.type_label ?? ''),
    date_id: r.date_id ? String(r.date_id) : null,
    place: String(r.place ?? ''),
    description: String(r.description ?? ''),
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
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

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createEvent(projectId: string, input: EventInput): Promise<string> {
  const id = uid()
  const dateVal = input.date ? buildDateValue(input.date) : null
  const now = new Date().toISOString()

  const stmts: { sql: string; params: unknown[] }[] = []
  if (dateVal) {
    stmts.push({
      sql: 'INSERT INTO date_value(id, qualifier, d1, d2, sort_key, label) VALUES(?1,?2,?3,?4,?5,?6)',
      params: [dateVal.id, dateVal.qualifier, dateVal.d1, dateVal.d2, dateVal.sort_key, dateVal.label],
    })
  }
  stmts.push({
    sql: `INSERT INTO event(id, person_id, union_id, type, type_label, date_id, place, description, created_at, updated_at)
          VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`,
    params: [
      id,
      input.person_id ?? null,
      input.union_id ?? null,
      input.type,
      (input.type_label ?? '').trim(),
      dateVal?.id ?? null,
      (input.place ?? '').trim(),
      (input.description ?? '').trim(),
      now,
      now,
    ],
  })
  await transaction(projectId, stmts)
  return id
}

export async function updateEvent(projectId: string, id: string, input: EventInput): Promise<void> {
  const dateVal = input.date ? buildDateValue(input.date) : null
  const now = new Date().toISOString()

  const stmts: { sql: string; params: unknown[] }[] = []
  if (dateVal) {
    stmts.push({
      sql: 'INSERT INTO date_value(id, qualifier, d1, d2, sort_key, label) VALUES(?1,?2,?3,?4,?5,?6)',
      params: [dateVal.id, dateVal.qualifier, dateVal.d1, dateVal.d2, dateVal.sort_key, dateVal.label],
    })
  }
  stmts.push({
    sql: `UPDATE event SET person_id=?2, union_id=?3, type=?4, type_label=?5, date_id=?6, place=?7, description=?8, updated_at=?9 WHERE id=?1`,
    params: [
      id,
      input.person_id ?? null,
      input.union_id ?? null,
      input.type,
      (input.type_label ?? '').trim(),
      dateVal?.id ?? null,
      (input.place ?? '').trim(),
      (input.description ?? '').trim(),
      now,
    ],
  })
  // Supprimer l'ancienne date_value si remplacée
  stmts.push({
    sql: `DELETE FROM date_value WHERE id IN (SELECT date_id FROM event WHERE id=?1 AND date_id IS NOT NULL AND date_id != ?2)`,
    params: [id, dateVal?.id ?? ''],
  })
  await transaction(projectId, stmts)
}

export async function deleteEvent(projectId: string, id: string): Promise<void> {
  // Récupérer le date_id avant suppression
  const rows = await query<{ date_id: string | null }>(projectId, 'SELECT date_id FROM event WHERE id=?1', [id])
  const dateId = rows[0]?.date_id
  const stmts: { sql: string; params: unknown[] }[] = [
    { sql: 'DELETE FROM event WHERE id=?1', params: [id] },
  ]
  if (dateId) {
    stmts.push({ sql: 'DELETE FROM date_value WHERE id=?1', params: [dateId] })
  }
  await transaction(projectId, stmts)
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

const EVENT_SELECT = `
  e.*,
  dv.id AS dv_id, dv.qualifier AS dv_qualifier, dv.d1 AS dv_d1, dv.d2 AS dv_d2,
  dv.sort_key AS dv_sort_key, dv.label AS dv_label`

function mapEventView(r: Record<string, unknown>): GeneEventView {
  const ev = mapEvent(r)
  const date: DateValue | null =
    r.dv_qualifier !== null && r.dv_qualifier !== undefined && String(r.dv_qualifier) !== ''
      ? mapDate({ id: r.dv_id, qualifier: r.dv_qualifier, d1: r.dv_d1, d2: r.dv_d2, sort_key: r.dv_sort_key, label: r.dv_label })
      : null
  return {
    ...ev,
    date,
    personName: r.person_name ? String(r.person_name) : undefined,
    unionLabel: r.union_label ? String(r.union_label) : undefined,
  }
}

export async function getEvent(projectId: string, id: string): Promise<GeneEventView | null> {
  const rows = await query<Record<string, unknown>>(
    projectId,
    `${EVENT_SELECT}
     FROM event e
     LEFT JOIN date_value dv ON dv.id = e.date_id
     WHERE e.id=?1`,
    [id],
  )
  return rows.length ? mapEventView(rows[0]) : null
}

export async function listEventsByPerson(projectId: string, personId: string): Promise<GeneEventView[]> {
  const rows = await query<Record<string, unknown>>(
    projectId,
    `${EVENT_SELECT}
     FROM event e
     LEFT JOIN date_value dv ON dv.id = e.date_id
     WHERE e.person_id=?1
     ORDER BY dv.sort_key, e.created_at`,
    [personId],
  )
  return rows.map(mapEventView)
}

export async function listEventsByUnion(projectId: string, unionId: string): Promise<GeneEventView[]> {
  const rows = await query<Record<string, unknown>>(
    projectId,
    `${EVENT_SELECT}
     FROM event e
     LEFT JOIN date_value dv ON dv.id = e.date_id
     WHERE e.union_id=?1
     ORDER BY dv.sort_key, e.created_at`,
    [unionId],
  )
  return rows.map(mapEventView)
}

export async function listAllEvents(projectId: string): Promise<GeneEventView[]> {
  const rows = await query<Record<string, unknown>>(
    projectId,
    `${EVENT_SELECT}
     LEFT JOIN person p ON p.id = e.person_id
     LEFT JOIN (
       SELECT u.id, GROUP_CONCAT(p2.surname, ' & ') AS union_label
       FROM union_family u
       JOIN union_partner up ON up.union_id = u.id
       JOIN person p2 ON p2.id = up.person_id
       WHERE u.deleted_at IS NULL
       GROUP BY u.id
     ) ufl ON ufl.id = e.union_id
     FROM event e
     LEFT JOIN date_value dv ON dv.id = e.date_id
     ORDER BY dv.sort_key, e.created_at`,
  )
  return rows.map(mapEventView)
}
