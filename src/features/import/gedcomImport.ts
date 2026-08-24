// ---------------------------------------------------------------------------
// Import GEDCOM 5.5.1 → base STEMMA (transaction atomique).
// ---------------------------------------------------------------------------
import { transaction } from '@/database/client'
import { uid } from '@/lib/dates'
import { buildDateValue, type DateInput } from '@/lib/dates'
import {
  parseGedcom,
  type GedcomDate,
  type GedcomFam,
} from './gedcomParser'

export interface ImportResult {
  personsCreated: number
  unionsCreated: number
  childrenLinked: number
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Conversion de dates GEDCOM → DateInput STEMMA
// ---------------------------------------------------------------------------

function gedcomDateToInput(d: GedcomDate | null): DateInput | undefined {
  if (!d) return undefined
  const raw = d.date.trim()

  let qualifier: DateInput['qualifier'] = 'exact'
  if (d.qualifier === 'about') qualifier = 'about'
  else if (d.qualifier === 'before') qualifier = 'before'
  else if (d.qualifier === 'after') qualifier = 'after'
  else if (d.qualifier === 'between') qualifier = 'between'

  return { qualifier, d1: raw, d2: '' }
}

function sexToStemma(gedcomSex: string): 'M' | 'F' | 'X' {
  if (gedcomSex === 'M') return 'M'
  if (gedcomSex === 'F') return 'F'
  return 'X'
}

// ---------------------------------------------------------------------------
// Détecter le type d'union (MARR → mariage, etc.)
// ---------------------------------------------------------------------------

function unionTypeFromGedcom(fam: GedcomFam): 'mariage' | 'union' | 'concubinage' {
  if (fam.marr) return 'mariage'
  return 'union'
}

function unionStatusFromGedcom(fam: GedcomFam): 'actuel' | 'passe' | 'divorce' {
  if (fam.div) return 'divorce'
  return 'actuel' // par défaut
}

// ---------------------------------------------------------------------------
// Fonction principale d'import
// ---------------------------------------------------------------------------

export async function importGedcom(
  projectId: string,
  gedcomText: string,
): Promise<ImportResult> {
  const tree = parseGedcom(gedcomText)
  const result: ImportResult = {
    personsCreated: 0,
    unionsCreated: 0,
    childrenLinked: 0,
    warnings: [],
  }

  if (tree.indi.size === 0) {
    result.warnings.push('Aucun individu trouvé dans le fichier GEDCOM.')
    return result
  }

  // Mapper les xref GEDCOM → IDs STEMMA
  const xrefToId = new Map<string, string>()

  // Générer un ID STEMMA pour chaque individu GEDCOM
  for (const [xref] of tree.indi) {
    xrefToId.set(xref, uid())
  }

  const stmts: { sql: string; params: unknown[] }[] = []
  const now = new Date().toISOString()

  // --- 1. Insérer les individus ---
  for (const [xref, indi] of tree.indi) {
    const id = xrefToId.get(xref)!
    const name = indi.names[0] ?? { given: '', surname: '', suffix: '' }
    const givenName = name.given || 'Inconnu'
    const surname = name.surname || ''

    // Person
    stmts.push({
      sql: `INSERT INTO person(id, given_name, surname, birth_name, sex, profession, description, notes, photo_id, created_at, updated_at)
            VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)`,
      params: [
        id, givenName, surname, '', sexToStemma(indi.sex),
        '', '', indi.notes.join('\n'), '', now, now,
      ],
    })

    // Birth date + place
    if (indi.birth) {
      const dateInput = gedcomDateToInput(indi.birth.date)
      if (dateInput || indi.birth.place) {
        const dv = dateInput ? buildDateValue(dateInput) : null
        if (dv) {
          stmts.push({
            sql: 'INSERT INTO date_value(id, qualifier, d1, d2, sort_key, label) VALUES(?1,?2,?3,?4,?5,?6)',
            params: [dv.id, dv.qualifier, dv.d1, dv.d2, dv.sort_key, dv.label],
          })
        }
        stmts.push({
          sql: `INSERT INTO person_date(person_id, kind, date_id, place) VALUES(?1,?2,?3,?4)`,
          params: [id, 'birth', dv?.id ?? '', indi.birth.place],
        })
      }
    }

    // Death date + place
    if (indi.death) {
      const dateInput = gedcomDateToInput(indi.death.date)
      if (dateInput || indi.death.place) {
        const dv = dateInput ? buildDateValue(dateInput) : null
        if (dv) {
          stmts.push({
            sql: 'INSERT INTO date_value(id, qualifier, d1, d2, sort_key, label) VALUES(?1,?2,?3,?4,?5,?6)',
            params: [dv.id, dv.qualifier, dv.d1, dv.d2, dv.sort_key, dv.label],
          })
        }
        stmts.push({
          sql: `INSERT INTO person_date(person_id, kind, date_id, place) VALUES(?1,?2,?3,?4)`,
          params: [id, 'death', dv?.id ?? '', indi.death.place],
        })
      }
    }

    result.personsCreated++
  }

  // --- 2. Insérer les familles (unions) ---
  for (const [xref, fam] of tree.fam) {
    const unionId = uid()
    const partnerIds: string[] = []

    if (fam.husb && xrefToId.has(fam.husb)) partnerIds.push(xrefToId.get(fam.husb)!)
    if (fam.wife && xrefToId.has(fam.wife)) partnerIds.push(xrefToId.get(fam.wife)!)

    if (partnerIds.length === 0) {
      result.warnings.push(`Famille ${xref} ignorée : aucun partenaire trouvé.`)
      continue
    }

    // Date de mariage → start_date_id
    let startId: string | null = null
    if (fam.marr) {
      const dateInput = gedcomDateToInput(fam.marr.date)
      if (dateInput) {
        const dv = buildDateValue(dateInput)
        stmts.push({
          sql: 'INSERT INTO date_value(id, qualifier, d1, d2, sort_key, label) VALUES(?1,?2,?3,?4,?5,?6)',
          params: [dv.id, dv.qualifier, dv.d1, dv.d2, dv.sort_key, dv.label],
        })
        startId = dv.id
      }
    }

    // Date de divorce → end_date_id
    let endId: string | null = null
    if (fam.div) {
      const dateInput = gedcomDateToInput(fam.div.date)
      if (dateInput) {
        const dv = buildDateValue(dateInput)
        stmts.push({
          sql: 'INSERT INTO date_value(id, qualifier, d1, d2, sort_key, label) VALUES(?1,?2,?3,?4,?5,?6)',
          params: [dv.id, dv.qualifier, dv.d1, dv.d2, dv.sort_key, dv.label],
        })
        endId = dv.id
      }
    }

    // Union
    stmts.push({
      sql: `INSERT INTO union_family(id, type, status, start_date_id, end_date_id, place, notes, created_at, updated_at)
            VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)`,
      params: [
        unionId,
        unionTypeFromGedcom(fam),
        unionStatusFromGedcom(fam),
        startId,
        endId,
        fam.marr?.place ?? '',
        '',
        now,
        now,
      ],
    })

    // Partners
    for (let i = 0; i < partnerIds.length; i++) {
      stmts.push({
        sql: 'INSERT INTO union_partner(union_id, person_id, role) VALUES(?1,?2,?3)',
        params: [unionId, partnerIds[i], i === 0 ? 'principal' : ''],
      })
    }

    // Children
    for (const childXref of fam.children) {
      const childId = xrefToId.get(childXref)
      if (!childId) {
        result.warnings.push(`Enfant ${childXref} dans famille ${xref} : ID inconnu.`)
        continue
      }
      stmts.push({
        sql: 'INSERT INTO union_child(union_id, child_id, relationship_type) VALUES(?1,?2,?3)',
        params: [unionId, childId, 'biologique'],
      })
      result.childrenLinked++
    }

    result.unionsCreated++
  }

  // --- 3. Exécuter la transaction ---
  if (stmts.length > 0) {
    await transaction(projectId, stmts)
  }

  return result
}
