// ---------------------------------------------------------------------------
// Tests de l'export GEDCOM 5.5.1 (repos mockés, aucun Tauri requis).
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/database/repositories/personRepo', () => ({
  getAllPeople: vi.fn(),
}))
vi.mock('@/database/repositories/unionRepo', () => ({
  listAllUnions: vi.fn(),
  listAllUnionPartners: vi.fn(),
  listChildLinks: vi.fn(),
}))

import { getAllPeople } from '@/database/repositories/personRepo'
import { listAllUnions, listAllUnionPartners, listChildLinks } from '@/database/repositories/unionRepo'
import { exportGedcom } from './gedcom'
import type { PersonDated, DateValue } from '@/types'

const person = (
  id: string,
  given: string,
  surname: string,
  over: Partial<PersonDated> = {},
): PersonDated => ({
  id, given_name: given, surname, birth_name: '', sex: 'M',
  profession: '', description: '', notes: '', photo_id: '',
  created_at: '', updated_at: '', deleted_at: null,
  birth: { date: null, place: '' }, death: { date: null, place: '' },
  ...over,
})

const union = (id: string): import('@/types').UnionFamily => ({
  id, type: 'mariage', status: 'passe', start_date_id: null, end_date_id: null,
  place: 'Tours', notes: '', created_at: '', updated_at: '', deleted_at: null,
})

beforeEach(() => {
  vi.mocked(getAllPeople).mockReset()
  vi.mocked(listAllUnions).mockReset()
  vi.mocked(listAllUnionPartners).mockReset()
  vi.mocked(listChildLinks).mockReset()
})

describe('exportGedcom', () => {
  it('exporte les en-têtes et chaque personne avec NAME/SEX', async () => {
    vi.mocked(getAllPeople).mockResolvedValue([person('1', 'Henri', 'Martin', { sex: 'M' })])
    vi.mocked(listAllUnions).mockResolvedValue([])
    vi.mocked(listAllUnionPartners).mockResolvedValue([])
    vi.mocked(listChildLinks).mockResolvedValue([])

    const ged = await exportGedcom('proj')
    expect(ged).toContain('0 HEAD')
    expect(ged).toContain('0 @P1@ INDI')
    expect(ged).toContain('1 NAME Henri /Martin/')
    expect(ged).toContain('1 SEX M')
    expect(ged.trim().endsWith('0 TRLR')).toBe(true)
  })

  it('exporte BIRT/DEAT avec dates et lieux', async () => {
    const date: DateValue = { id: 'd', qualifier: 'exact', d1: '15/03/1898', d2: '', sort_key: 1898, label: '15/03/1898' }
    vi.mocked(getAllPeople).mockResolvedValue([
      person('1', 'Henri', 'Martin', {
        birth: { date, place: 'Tours' },
        death: { date, place: 'Blois' },
      }),
    ])
    vi.mocked(listAllUnions).mockResolvedValue([])
    vi.mocked(listAllUnionPartners).mockResolvedValue([])
    vi.mocked(listChildLinks).mockResolvedValue([])

    const ged = await exportGedcom('proj')
    expect(ged).toContain('1 BIRT')
    expect(ged).toContain('2 DATE 15/03/1898')
    expect(ged).toContain('2 PLAC Tours')
    expect(ged).toContain('1 DEAT')
    expect(ged).toContain('2 PLAC Blois')
  })

  it('exporte une famille HUSB/WIFE/CHIL avec les liens FAMC/FAMS', async () => {
    vi.mocked(getAllPeople).mockResolvedValue([
      person('a', 'Henri', 'Martin', { sex: 'M' }),
      person('b', 'Élise', 'Fontaine', { sex: 'F' }),
      person('c', 'Pierre', 'Martin', { sex: 'M' }),
    ])
    vi.mocked(listAllUnions).mockResolvedValue([union('u1')])
    vi.mocked(listAllUnionPartners).mockResolvedValue([
      { union_id: 'u1', person_id: 'a' },
      { union_id: 'u1', person_id: 'b' },
    ])
    vi.mocked(listChildLinks).mockResolvedValue([
      { union_id: 'u1', child_id: 'c', relationship_type: 'biologique' },
    ])

    const ged = await exportGedcom('proj')
    expect(ged).toContain('0 @F1@ FAM')
    expect(ged).toContain('1 HUSB @P1@')
    expect(ged).toContain('1 WIFE @P2@')
    expect(ged).toContain('1 CHIL @P3@')
    // FAMC sur l'enfant, FAMS sur les parents
    const indiChild = ged.split('0 @P3@ INDI')[1].split('0 @')[0]
    expect(indiChild).toContain('1 FAMC @F1@')
    const indiDad = ged.split('0 @P1@ INDI')[1].split('0 @')[0]
    expect(indiDad).toContain('1 FAMS @F1@')
  })
})