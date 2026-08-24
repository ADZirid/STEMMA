// ---------------------------------------------------------------------------
// TEST D'INTÉGRATION HEADLESS (sans Tauri, sans GUI).
// Les vrais repositories TypeScript s'exécutent contre un vrai SQLite en
// mémoire via node:sqlite, avec les vraies migrations du projet.
// ---------------------------------------------------------------------------
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/database/client', async () => {
  const { DatabaseSync } = await import('node:sqlite')
  const MIGRATIONS = readFileSync(
    join(process.cwd(), 'src-tauri', 'migrations', '0001_schema.sql'),
    'utf8',
  )
  const conns = new Map<string, ReturnType<typeof open>>()

  function open(projectId: string) {
    const db = new DatabaseSync(':memory:')
    db.exec(MIGRATIONS)
    conns.set(projectId, db)
    return db
  }
  function conn(projectId: string) {
    return conns.get(projectId) ?? open(projectId)
  }

  return {
    exec: async (
      projectId: string,
      sql: string,
      params: unknown[] = [],
    ): Promise<{ last_insert_id: number | null; rows_affected: number }> => {
      const db = conn(projectId)
      const stmt = db.prepare(sql)
      const info = stmt.run(...(params as never[]))
      return {
        last_insert_id: typeof info.lastInsertRowid === 'number' ? info.lastInsertRowid : null,
        rows_affected: Number(info.changes),
      }
    },
    query: async <T = Record<string, unknown>>(
      projectId: string,
      sql: string,
      params: unknown[] = [],
    ): Promise<T[]> => {
      const db = conn(projectId)
      return db.prepare(sql).all(...(params as never[])) as T[]
    },
    transaction: async (
      projectId: string,
      statements: { sql: string; params?: unknown[] }[],
    ): Promise<unknown[]> => {
      const db = conn(projectId)
      db.exec('BEGIN')
      try {
        for (const s of statements) {
          db.prepare(s.sql).run(...((s.params ?? []) as never[]))
        }
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
      return []
    },
    integrityCheck: async (_projectId: string) => ({ ok: true, details: [] }),
    isTauri: false,
    DbError: class DbError extends Error {},
    isExecResult: (v: unknown): boolean =>
      typeof v === 'object' && v !== null && 'rows_affected' in v,
  }
})

// Repositories RÉELS (non mockés) — seule la couche de transport l'est.
import { createPerson, getPerson, updatePerson, listPeople, getAllPeople, softDeletePeople, restorePeople, purgePeople } from '@/database/repositories/personRepo'
import { createUnion, getUnion, listAllUnionViews, listPersonUnions, addUnionChild, removeUnionChild, softDeleteUnion } from '@/database/repositories/unionRepo'
import { createSource, listSources, addCitation } from '@/database/repositories/sourceRepo'
import { buildRelGraph, relationshipBetween, parentsOf, childrenOf, siblingsOf } from '@/features/tree/engine'
import { exportGedcom } from '@/features/export/gedcom'

let pid = 0
function projectId(): string {
  pid += 1
  return `proj-${pid}`
}

const date = (d1: string, qualifier: 'exact' | 'about' = 'exact') => ({
  date: { qualifier, d1, d2: '' },
})

describe('intégration bout en bout (SQLite en mémoire)', () => {
  it('CRUD personne : création, dates, édition, recherche, corbeille, purge', async () => {
    const p = projectId()

    const id = await createPerson(p, {
      given_name: 'Jean', surname: 'Dupont', birth_name: '', sex: 'M',
      profession: 'Boulanger', description: '', notes: 'Né à Lyon',
      birth: { date: date('15/03/1950').date, place: 'Lyon' },
      death: {},
    })

    const got = await getPerson(p, id)
    expect(got).not.toBeNull()
    expect(got!.birth.date?.qualifier).toBe('exact')
    expect(got!.birth.date?.d1).toBe('15/03/1950')
    expect(got!.birth.place).toBe('Lyon')

    await updatePerson(p, id, {
      given_name: 'Jean-Pierre', surname: 'Dupont', birth_name: '', sex: 'M',
      profession: 'Boulanger', description: '', notes: 'Né à Lyon',
      birth: { date: date('15/03/1950').date, place: 'Lyon' },
      death: {},
    })
    expect((await getPerson(p, id))!.given_name).toBe('Jean-Pierre')

    // Recherche insensible aux accents et à la casse
    const res = await listPeople(p, { search: 'dupont' })
    expect(res.total).toBe(1)
    expect(res.rows[0].id).toBe(id)

    // Corbeille (soft delete) puis restauration
    await softDeletePeople(p, [id])
    expect((await listPeople(p, {})).total).toBe(0)
    await restorePeople(p, [id])
    expect((await listPeople(p, {})).total).toBe(1)

    // Purge définitive (cascade)
    await purgePeople(p, [id])
    expect(await getPerson(p, id)).toBeNull()
  })

  it('unions : partenaires multiples, enfants, vues, suppression', async () => {
    const p = projectId()
    const a = await createPerson(p, { given_name: 'A', surname: 'X', birth_name: '', sex: 'M', profession: '', description: '', notes: '' })
    const b = await createPerson(p, { given_name: 'B', surname: 'Y', birth_name: '', sex: 'F', profession: '', description: '', notes: '' })
    const c = await createPerson(p, { given_name: 'C', surname: 'Z', birth_name: '', sex: 'M', profession: '', description: '', notes: '' })

    const uid = await createUnion(p, {
      type: 'mariage', status: 'actuel', place: 'Lyon',
      start: { date: date('1975').date },
      partner_ids: [a, b],
      children: [{ child_id: c, relationship_type: 'biologique' }],
    })

    const view = await getUnion(p, uid)
    expect(view).not.toBeNull()
    expect(view!.partners.map((x) => x.id).sort()).toEqual([a, b].sort())
    expect(view!.children).toHaveLength(1)
    expect(view!.children[0].person.id).toBe(c)
    expect(view!.union.place).toBe('Lyon')

    // Nouvel enfant ajouté après coup
    const d = await createPerson(p, { given_name: 'D', surname: 'W', birth_name: '', sex: 'F', profession: '', description: '', notes: '' })
    await addUnionChild(p, uid, d)
    expect((await getUnion(p, uid))!.children).toHaveLength(2)

    await removeUnionChild(p, uid, d)
    expect((await getUnion(p, uid))!.children).toHaveLength(1)

    expect((await listPersonUnions(p, a)).length).toBe(1)
    expect((await listAllUnionViews(p)).length).toBe(1)

    await softDeleteUnion(p, uid)
    expect((await listAllUnionViews(p)).length).toBe(0)
  })

  it('relations calculées : parents, enfants, demi-frères/sœurs, conjoints', async () => {
    const p = projectId()
    const mk = (given: string, sex: 'M' | 'F') =>
      createPerson(p, { given_name: given, surname: 'F', birth_name: '', sex, profession: '', description: '', notes: '' })

    const [pere, mere, second, c1, c2] = await Promise.all([
      mk('Père', 'M'), mk('Mère', 'F'), mk('Seconde', 'F'), mk('C1', 'M'), mk('C2', 'M'),
    ])

    // Première union : père + mère → C1
    const u1 = await createUnion(p, {
      type: 'mariage', status: 'passe', place: '',
      partner_ids: [pere, mere],
      children: [{ child_id: c1, relationship_type: 'biologique' }],
    })
    // Seconde union : père + seconde → C2 (demi-frère de C1)
    const u2 = await createUnion(p, {
      type: 'mariage', status: 'actuel', place: '',
      partner_ids: [pere, second],
      children: [{ child_id: c2, relationship_type: 'biologique' }],
    })

    const g = await buildRelGraph(p)

    expect(parentsOf(g, c1).map((e) => e.parent_id).sort()).toEqual([mere, pere].sort())
    expect(childrenOf(g, pere).has(c1)).toBe(true)
    expect(childrenOf(g, pere).has(c2)).toBe(true)

    const sib = siblingsOf(g, c1)
    expect(sib.full).toEqual([])
    expect(sib.half).toEqual([c2])

    expect(relationshipBetween(g, c1, c2).kind).toBe('demi-fratrie')
    expect(relationshipBetween(g, pere, c1).kind).toBe('parent')
    expect(relationshipBetween(g, c1, pere).kind).toBe('enfant')

    // Conjoints via statut d'union
    expect(g.partners.get(pere)!.map((e) => e.other_id).sort()).toEqual([mere, second].sort())
    expect(relationshipBetween(g, pere, second).kind).toBe('conjoint')

    void u1
    void u2
  })

  it('export GEDCOM de bout en bout (repos réels)', async () => {
    const p = projectId()
    const mk = (given: string, sex: 'M' | 'F') =>
      createPerson(p, { given_name: given, surname: 'Martin', birth_name: '', sex, profession: '', description: '', notes: '' })

    const [henri, elise, pierre] = await Promise.all([
      mk('Henri', 'M'), mk('Élise', 'F'), mk('Pierre', 'M'),
    ])
    await createUnion(p, {
      type: 'mariage', status: 'passe', place: 'Tours',
      start: { date: date('1923').date },
      partner_ids: [henri, elise],
      children: [{ child_id: pierre, relationship_type: 'biologique' }],
    })

    const ged = await exportGedcom(p)
    expect(ged).toContain('0 HEAD')
    expect(ged).toContain('1 NAME Henri /Martin/')
    expect(ged).toContain('1 NAME Élise /Martin/')
    expect(ged).toContain('1 SEX F')
    expect(ged).toContain('0 @F1@ FAM')
    expect(ged).toContain('1 HUSB @P')
    expect(ged).toContain('1 WIFE @P')
    expect(ged).toContain('1 CHIL @P3@')
    expect(ged).toContain('0 TRLR')
  })

  it('sources + citations', async () => {
    const p = projectId()
    const sid = await createSource(p, {
      title: 'Registre de Tours', author: 'ADT', date: '1898',
      archive: 'ADT', reference: '1E/014', url: '', comment: '',
    })
    expect((await listSources(p)).length).toBe(1)
    expect((await listSources(p))[0].title).toBe('Registre de Tours')

    const personId = await createPerson(p, { given_name: 'H', surname: 'M', birth_name: '', sex: 'M', profession: '', description: '', notes: '' })
    await addCitation(p, { source_id: sid, person_id: personId, quote: 'acte n°12', page: 'p. 8' })
    expect((await getAllPeople(p)).length).toBe(1)
  })
})