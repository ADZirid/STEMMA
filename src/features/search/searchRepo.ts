// ---------------------------------------------------------------------------
// Recherche étendue : personnes, unions, sources, événements.
// Approche simple : requêtes LIKE sur les tables existantes (pas de FTS5).
// ---------------------------------------------------------------------------
import { query } from '@/database/client'
import type { PersonDated, UnionView, Source, GeneEventView } from '@/types'
import { normalizeText } from '@/lib/normalize'

// ---------------------------------------------------------------------------
// Types de résultat
// ---------------------------------------------------------------------------

export type SearchCategory = 'person' | 'union' | 'source' | 'event'

export interface SearchResult {
  category: SearchCategory
  id: string
  title: string
  subtitle: string
  /** Données brutes pour affichage enrichi. */
  data: PersonDated | UnionView | Source | GeneEventView
}

// ---------------------------------------------------------------------------
// Recherche par catégorie
// ---------------------------------------------------------------------------

async function searchPersons(projectId: string, term: string): Promise<SearchResult[]> {
  const rows = await query<Record<string, unknown>>(
    projectId,
    `SELECT p.*,
       pdb.kind AS b_kind, db.qualifier AS b_qualifier, db.d1 AS b_d1, db.d2 AS b_d2,
       db.sort_key AS b_sort_key, db.label AS b_label, pdb.place AS b_place,
       pdd.kind AS d_kind, dd.qualifier AS d_qualifier, dd.d1 AS d_d1, dd.d2 AS d_d2,
       dd.sort_key AS d_sort_key, dd.label AS d_label, pdd.place AS d_place
     FROM person p
     LEFT JOIN person_search ps ON ps.person_id = p.id
     LEFT JOIN person_date pdb ON pdb.person_id = p.id AND pdb.kind = 'birth'
     LEFT JOIN date_value db ON db.id = pdb.date_id
     LEFT JOIN person_date pdd ON pdd.person_id = p.id AND pdd.kind = 'death'
     LEFT JOIN date_value dd ON dd.id = pdd.date_id
     WHERE p.deleted_at IS NULL
       AND (ps.search_text LIKE ?1 OR p.given_name LIKE ?2 OR p.surname LIKE ?2 OR p.profession LIKE ?2 OR p.notes LIKE ?2)
     ORDER BY ps.sort_name COLLATE NOCASE
     LIMIT 50`,
    [`%${term}%`, `%${term}%`],
  )

  return rows.map((r) => {
    const p: PersonDated = {
      id: String(r.id ?? ''),
      given_name: String(r.given_name ?? ''),
      surname: String(r.surname ?? ''),
      birth_name: String(r.birth_name ?? ''),
      sex: (r.sex as 'M' | 'F' | 'X') ?? 'X',
      profession: String(r.profession ?? ''),
      description: String(r.description ?? ''),
      notes: String(r.notes ?? ''),
      photo_id: String(r.photo_id ?? ''),
      created_at: String(r.created_at ?? ''),
      updated_at: String(r.updated_at ?? ''),
      deleted_at: r.deleted_at ? String(r.deleted_at) : null,
      birth: { date: null, place: String(r.b_place ?? '') },
      death: { date: null, place: String(r.d_place ?? '') },
    }
    return {
      category: 'person' as SearchCategory,
      id: p.id,
      title: [p.given_name, p.surname].filter(Boolean).join(' ') || 'Sans nom',
      subtitle: [p.profession, p.birth?.place].filter(Boolean).join(' · ') || 'Personne',
      data: p,
    }
  })
}

async function searchUnions(projectId: string, term: string): Promise<SearchResult[]> {
  const rows = await query<Record<string, unknown>>(
    projectId,
    `SELECT u.*,
       GROUP_CONCAT(p.given_name || ' ' || p.surname, ' & ') AS partner_names
     FROM union_family u
     JOIN union_partner up ON up.union_id = u.id
     JOIN person p ON p.id = up.person_id
     WHERE u.deleted_at IS NULL
     GROUP BY u.id
     HAVING partner_names LIKE ?1 OR u.place LIKE ?1 OR u.notes LIKE ?1
     ORDER BY u.created_at DESC
     LIMIT 30`,
    [`%${term}%`],
  )

  return rows.map((r) => ({
    category: 'union' as SearchCategory,
    id: String(r.id ?? ''),
    title: String(r.partner_names ?? 'Union'),
    subtitle: [String(r.type ?? ''), String(r.place ?? '')].filter(Boolean).join(' · ') || 'Union',
    data: {
      union: {
        id: String(r.id ?? ''),
        type: (r.type ?? 'union') as UnionView['union']['type'],
        status: (r.status ?? 'actuel') as UnionView['union']['status'],
        start_date_id: r.start_date_id ? String(r.start_date_id) : null,
        end_date_id: r.end_date_id ? String(r.end_date_id) : null,
        place: String(r.place ?? ''),
        notes: String(r.notes ?? ''),
        created_at: String(r.created_at ?? ''),
        updated_at: String(r.updated_at ?? ''),
        deleted_at: r.deleted_at ? String(r.deleted_at) : null,
      },
      start: null,
      end: null,
      partners: [],
      children: [],
    } as UnionView,
  }))
}

async function searchSources(projectId: string, term: string): Promise<SearchResult[]> {
  const rows = await query<Record<string, unknown>>(
    projectId,
    `SELECT * FROM source
     WHERE title LIKE ?1 OR author LIKE ?1 OR archive LIKE ?1 OR reference LIKE ?1 OR comment LIKE ?1
     ORDER BY title COLLATE NOCASE
     LIMIT 30`,
    [`%${term}%`],
  )

  return rows.map((r) => ({
    category: 'source' as SearchCategory,
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    subtitle: [String(r.author ?? ''), String(r.date ?? '')].filter(Boolean).join(' · ') || 'Source',
    data: {
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
    } as Source,
  }))
}

async function searchEvents(projectId: string, term: string): Promise<SearchResult[]> {
  const rows = await query<Record<string, unknown>>(
    projectId,
    `SELECT e.*,
       p.given_name || ' ' || p.surname AS person_name,
       dv.label AS date_label
     FROM event e
     LEFT JOIN person p ON p.id = e.person_id
     LEFT JOIN date_value dv ON dv.id = e.date_id
     WHERE e.description LIKE ?1 OR e.place LIKE ?1 OR e.type_label LIKE ?1
        OR (p.given_name || ' ' || p.surname) LIKE ?1
     ORDER BY dv.sort_key
     LIMIT 30`,
    [`%${term}%`],
  )

  return rows.map((r) => ({
    category: 'event' as SearchCategory,
    id: String(r.id ?? ''),
    title: String(r.type_label ?? r.type ?? 'Événement'),
    subtitle: [String(r.person_name ?? ''), String(r.place ?? ''), String(r.date_label ?? '')].filter(Boolean).join(' · ') || 'Événement',
    data: {
      id: String(r.id ?? ''),
      person_id: r.person_id ? String(r.person_id) : null,
      union_id: r.union_id ? String(r.union_id) : null,
      type: r.type ?? 'personnalise',
      type_label: String(r.type_label ?? ''),
      date_id: r.date_id ? String(r.date_id) : null,
      place: String(r.place ?? ''),
      description: String(r.description ?? ''),
      created_at: String(r.created_at ?? ''),
      updated_at: String(r.updated_at ?? ''),
      date: null,
    } as GeneEventView,
  }))
}

// ---------------------------------------------------------------------------
// Recherche globale
// ---------------------------------------------------------------------------

export async function searchAll(projectId: string, rawTerm: string): Promise<SearchResult[]> {
  const term = normalizeText(rawTerm).trim()
  if (term.length < 2) return []

  const [persons, unions, sources, events] = await Promise.all([
    searchPersons(projectId, term),
    searchUnions(projectId, term),
    searchSources(projectId, term),
    searchEvents(projectId, term),
  ])

  return [...persons, ...unions, ...sources, ...events]
}

export async function searchByCategory(
  projectId: string,
  rawTerm: string,
  category: SearchCategory,
): Promise<SearchResult[]> {
  const term = normalizeText(rawTerm).trim()
  if (term.length < 2) return []

  switch (category) {
    case 'person': return searchPersons(projectId, term)
    case 'union': return searchUnions(projectId, term)
    case 'source': return searchSources(projectId, term)
    case 'event': return searchEvents(projectId, term)
  }
}
