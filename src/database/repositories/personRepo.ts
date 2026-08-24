// ---------------------------------------------------------------------------
// Repository des personnes — tout le SQL applicatif vit ici (TypeScript).
// ---------------------------------------------------------------------------
import { exec, query, transaction } from '@/database/client'
import type { Person, PersonDated, DateValue } from '@/types'
import { buildDateValue, uid, type DateInput } from '@/lib/dates'
import { personSortName, personSearchText } from '@/lib/normalize'

export interface PersonInput {
  given_name: string
  surname: string
  birth_name: string
  sex: Person['sex']
  profession: string
  description: string
  notes: string
  photo_id?: string
  birth?: { date?: DateInput; place?: string }
  death?: { date?: DateInput; place?: string }
}

const PERSON_COLS = ['id', 'given_name', 'surname', 'birth_name', 'sex', 'profession', 'description', 'notes', 'photo_id', 'created_at', 'updated_at', 'deleted_at'] as const

function mapRow(r: Record<string, unknown>): Person {
  const p = {} as Record<string, unknown>
  for (const c of PERSON_COLS) p[c] = r[c] ?? null
  return p as unknown as Person
}

function mapDated(r: Record<string, unknown>): PersonDated {
  const person = mapRow(r)
  const makeDate = (tag: 'b' | 'd'): { date: DateValue | null; place: string } => {
    const qualifier = r[`${tag}_qualifier`] as string | null
    if (!qualifier || qualifier === '') {
      return { date: null, place: String(r[`${tag}_place`] ?? '') }
    }
    return {
      date: {
        id: String(r[`${tag}_date_id`] ?? ''),
        qualifier: qualifier as DateValue['qualifier'],
        d1: String(r[`${tag}_d1`] ?? ''),
        d2: String(r[`${tag}_d2`] ?? ''),
        sort_key: (r[`${tag}_sort_key`] as number | null) ?? null,
        label: String(r[`${tag}_label`] ?? ''),
      },
      place: String(r[`${tag}_place`] ?? ''),
    }
  }
  const dt = { date: null, place: '' }
  return { ...person, birth: qualifierMissing(r, 'b') ? makeDate('b') : dt, death: qualifierMissing(r, 'd') ? makeDate('d') : dt }
}

// helper : un qualifier vide signifie « aucune date enregistrée »
function qualifierMissing(r: Record<string, unknown>, tag: 'b' | 'd'): boolean {
  const q = r[`${tag}_qualifier`]
  return q !== null && q !== undefined && String(q) !== ''
}

const DATES_JOIN = `
  LEFT JOIN person_date pdb ON pdb.person_id = p.id AND pdb.kind='birth'
  LEFT JOIN date_value db ON db.id = pdb.date_id
  LEFT JOIN person_date pdd ON pdd.person_id = p.id AND pdd.kind='death'
  LEFT JOIN date_value dd ON dd.id = pdd.date_id`

const DATES_SELECT = `
  db.id AS b_date_id, db.qualifier AS b_qualifier, db.d1 AS b_d1, db.d2 AS b_d2,
  db.sort_key AS b_sort_key, db.label AS b_label, pdb.place AS b_place,
  dd.id AS d_date_id, dd.qualifier AS d_qualifier, dd.d1 AS d_d1, dd.d2 AS d_d2,
  dd.sort_key AS d_sort_key, dd.label AS d_label, pdd.place AS d_place`

export async function createPerson(projectId: string, input: PersonInput): Promise<string> {
  const id = uid()
  await savePerson(projectId, id, input)
  return id
}

export async function updatePerson(projectId: string, id: string, input: PersonInput): Promise<void> {
  await savePerson(projectId, id, input)
}

async function savePerson(projectId: string, id: string, input: PersonInput): Promise<void> {
  const bDate = input.birth?.date ? buildDateValue(input.birth.date) : null
  const dDate = input.death?.date ? buildDateValue(input.death.date) : null
  const now = new Date().toISOString()

  const stmts: { sql: string; params: unknown[] }[] = [
    {
      sql: `INSERT INTO person (id, given_name, surname, birth_name, sex, profession, description, notes, photo_id, created_at, updated_at)
            VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
            ON CONFLICT(id) DO UPDATE SET
              given_name=excluded.given_name, surname=excluded.surname, birth_name=excluded.birth_name,
              sex=excluded.sex, profession=excluded.profession, description=excluded.description,
              notes=excluded.notes, photo_id=excluded.photo_id, updated_at=excluded.updated_at`,
      params: [id, input.given_name.trim(), input.surname.trim(), input.birth_name.trim(), input.sex || 'X', input.profession.trim(), input.description.trim(), input.notes.trim(), (input.photo_id ?? '').trim(), now, now],
    },
    { sql: 'DELETE FROM person_date WHERE person_id=?1', params: [id] },
  ]
  if (bDate) {
    stmts.push(
      { sql: 'INSERT INTO date_value(id, qualifier, d1, d2, sort_key, label) VALUES(?1,?2,?3,?4,?5,?6)', params: [bDate.id, bDate.qualifier, bDate.d1, bDate.d2, bDate.sort_key, bDate.label] },
      { sql: "INSERT INTO person_date(person_id, kind, date_id, place) VALUES(?1,'birth',?2,?3)", params: [id, bDate.id, (input.birth?.place ?? '').trim()] },
    )
  }
  if (dDate) {
    stmts.push(
      { sql: 'INSERT INTO date_value(id, qualifier, d1, d2, sort_key, label) VALUES(?1,?2,?3,?4,?5,?6)', params: [dDate.id, dDate.qualifier, dDate.d1, dDate.d2, dDate.sort_key, dDate.label] },
      { sql: "INSERT INTO person_date(person_id, kind, date_id, place) VALUES(?1,'death',?2,?3)", params: [id, dDate.id, (input.death?.place ?? '').trim()] },
    )
  }
  stmts.push({
    sql: `INSERT INTO person_search(person_id, sort_name, search_text) VALUES(?1,?2,?3)
          ON CONFLICT(person_id) DO UPDATE SET sort_name=excluded.sort_name, search_text=excluded.search_text`,
    params: [id, personSortName(input.given_name, input.surname), personSearchText(input)],
  })
  await transaction(projectId, stmts)
}

const PERSON_BASE = `SELECT p.*, ${DATES_SELECT} FROM person p ${DATES_JOIN}`

export async function getPerson(projectId: string, id: string): Promise<PersonDated | null> {
  const rows = await query<Record<string, unknown>>(projectId, `${PERSON_BASE} WHERE p.id=?1`, [id])
  return rows.length ? mapDated(rows[0]) : null
}

export interface PeopleQuery {
  search?: string
  limit?: number
  offset?: number
  includeDeleted?: boolean
}

export interface PeoplePageResult {
  rows: PersonDated[]
  total: number
}

export async function listPeople(projectId: string, q: PeopleQuery = {}): Promise<PeoplePageResult> {
  const limit = q.limit ?? 50
  const offset = q.offset ?? 0
  const deletedFilter = q.includeDeleted ? '' : 'AND p.deleted_at IS NULL'

  // Paramètres numérotés séquentiellement (?1, ?2, …) : compatibles rusqlite ET node:sqlite.
  let where = 'WHERE 1=1'
  const params: unknown[] = []
  let n = 0
  if (q.search && q.search.trim()) {
    n += 1
    where += ` AND ps.search_text LIKE ?${n}`
    params.push(`%${q.search.toLowerCase().trim()}%`)
  }
  where += ` ${deletedFilter}`

  const countRows = await query<{ n: number }>(
    projectId,
    `SELECT COUNT(*) AS n FROM person p LEFT JOIN person_search ps ON ps.person_id=p.id ${where}`,
    params,
  )
  const total = Number(countRows[0]?.n ?? 0)

  n += 1
  const limitIdx = n
  n += 1
  const offsetIdx = n
  const rows = await query<Record<string, unknown>>(
    projectId,
    `${PERSON_BASE} LEFT JOIN person_search ps ON ps.person_id = p.id
     ${where} ORDER BY ps.sort_name COLLATE NOCASE, p.surname, p.given_name LIMIT ?${limitIdx} OFFSET ?${offsetIdx}`,
    [...params, limit, offset],
  )
  return { rows: rows.map(mapDated), total }
}

export async function softDeletePeople(projectId: string, ids: string[]): Promise<void> {
  if (!ids.length) return
  await exec(projectId, `UPDATE person SET deleted_at=datetime('now') WHERE id IN (${ids.map(() => '?').join(',')})`, ids)
}

export async function restorePeople(projectId: string, ids: string[]): Promise<void> {
  if (!ids.length) return
  await exec(projectId, `UPDATE person SET deleted_at=NULL WHERE id IN (${ids.map(() => '?').join(',')})`, ids)
}

/** Suppression définitive (avec confirmation en amont) — tout est cascade. */
export async function purgePeople(projectId: string, ids: string[]): Promise<void> {
  if (!ids.length) return
  await exec(projectId, `DELETE FROM person WHERE id IN (${ids.map(() => '?').join(',')})`, ids)
}

export async function getPeopleByIds(projectId: string, ids: string[]): Promise<Person[]> {
  if (!ids.length) return []
  const rows = await query<Record<string, unknown>>(
    projectId,
    `SELECT * FROM person WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  )
  return rows.map(mapRow)
}

export async function getAllPeople(projectId: string): Promise<PersonDated[]> {
  const rows = await query<Record<string, unknown>>(
    projectId,
    `${PERSON_BASE} LEFT JOIN person_search ps ON ps.person_id = p.id
     WHERE p.deleted_at IS NULL
     ORDER BY ps.sort_name COLLATE NOCASE, p.surname, p.given_name`,
  )
  return rows.map(mapDated)
}

export function personToSearchInput(p: Pick<Person, 'given_name' | 'surname' | 'birth_name' | 'profession' | 'notes'>): { given_name: string; surname: string; birth_name: string; profession: string; notes: string } {
  return { given_name: p.given_name, surname: p.surname, birth_name: p.birth_name, profession: p.profession, notes: p.notes }
}

/** Met à jour uniquement la photo principale. */
export async function setPhoto(projectId: string, personId: string, photoId: string): Promise<void> {
  await exec(projectId, 'UPDATE person SET photo_id=?1, updated_at=datetime(\'now\') WHERE id=?2', [photoId, personId])
}