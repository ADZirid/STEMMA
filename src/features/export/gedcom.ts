// ---------------------------------------------------------------------------
// Export GEDCOM 5.5.1 : personnes + familles, généré localement (aucun réseau).
// ---------------------------------------------------------------------------
import type { PersonDated, UnionFamily } from '@/types'
import { getAllPeople } from '@/database/repositories/personRepo'
import {
  listAllUnions,
  listAllUnionPartners,
  listChildLinks,
} from '@/database/repositories/unionRepo'

export function formatGedcomDate(d1: string): string {
  return d1 || ''
}

export async function exportGedcom(projectId: string): Promise<string> {
  const [people, unions, partners, childRows] = await Promise.all([
    getAllPeople(projectId),
    listAllUnions(projectId),
    listAllUnionPartners(projectId),
    listChildLinks(projectId),
  ])

  const gidOfPerson = new Map(people.map((p, i) => [p.id, `P${i + 1}`]))
  const gidOfFamily = new Map(unions.map((u, i) => [u.id, `F${i + 1}`]))

  const families = new Map<string, { partners: string[]; children: string[] }>()
  for (const u of unions) families.set(u.id, { partners: [], children: [] })
  for (const p of partners) families.get(p.union_id)?.partners.push(p.person_id)
  for (const c of childRows) families.get(c.union_id)?.children.push(c.child_id)

  const familiesOfPerson = new Map<string, string[]>() // FAMS
  const famcOfPerson = new Map<string, string[]>() // FAMC
  for (const [uid, f] of families) {
    const gid = gidOfFamily.get(uid)!
    for (const pid of f.partners) {
      const list = familiesOfPerson.get(pid) ?? []
      list.push(gid)
      familiesOfPerson.set(pid, list)
    }
    for (const cid of f.children) {
      const list = famcOfPerson.get(cid) ?? []
      list.push(gid)
      famcOfPerson.set(cid, list)
    }
  }

  const lines: string[] = [
    '0 HEAD',
    '1 SOUR STEMMA',
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
  ]

  const emitPerson = (p: PersonDated, gid: string) => {
    lines.push(`0 @${gid}@ INDI`)
    lines.push(`1 NAME ${p.given_name} /${p.surname || '?'}/`)
    if (p.birth_name && p.birth_name !== p.surname) {
      lines.push(`1 NAME ${p.given_name} /${p.birth_name}/`)
    }
    if (p.sex) lines.push(`1 SEX ${p.sex}`)
    if (p.birth?.date && p.birth.date.qualifier !== 'unknown') {
      lines.push('1 BIRT')
      lines.push(`2 DATE ${formatGedcomDate(p.birth.date.d1)}`)
      if (p.birth.place) lines.push(`2 PLAC ${p.birth.place}`)
    }
    if (p.death?.date && p.death.date.qualifier !== 'unknown') {
      lines.push('1 DEAT')
      lines.push(`2 DATE ${formatGedcomDate(p.death.date.d1)}`)
      if (p.death.place) lines.push(`2 PLAC ${p.death.place}`)
    }
    for (const g of famcOfPerson.get(p.id) ?? []) lines.push(`1 FAMC @${g}@`)
    for (const g of familiesOfPerson.get(p.id) ?? []) lines.push(`1 FAMS @${g}@`)
  }

  for (const p of people) emitPerson(p, gidOfPerson.get(p.id)!)

  for (const u of unions) {
    const f = families.get(u.id)!
    if (!f.partners.length) continue
    lines.push(`0 @${gidOfFamily.get(u.id)!}@ FAM`)
    f.partners.forEach((pid, i) => {
      const gid = gidOfPerson.get(pid)
      if (!gid) return
      lines.push(`1 ${i === 0 ? 'HUSB' : i === 1 ? 'WIFE' : '_MULT'} @${gid}@`)
    })
    for (const cid of f.children) {
      const gid = gidOfPerson.get(cid)
      if (!gid) continue
      lines.push(`1 CHIL @${gid}@`)
    }
  }

  lines.push('0 TRLR')
  return lines.join('\n')
}

export type { UnionFamily }