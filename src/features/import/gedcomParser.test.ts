// Tests du parser GEDCOM 5.5.1
import { describe, it, expect } from 'vitest'
import { parseGedcomLines, buildRecordTree, parseGedcom } from './gedcomParser'

const SAMPLE_GEDCOM = `0 HEAD
1 SOUR TEST
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
0 @I1@ INDI
1 NAME Jean /Dupont/
1 SEX M
1 BIRT
2 DATE 1 JAN 1950
2 PLAC Paris, France
1 DEAT
2 DATE 15 MAR 2020
2 PLAC Lyon, France
1 FAMC @F1@
1 FAMS @F2@
0 @I2@ INDI
1 NAME Marie /Martin/
1 SEX F
1 BIRT
2 DATE ABT 1952
1 FAMS @F2@
0 @I3@ INDI
1 NAME Paul /Dupont/
1 SEX M
1 BIRT
2 DATE 10 JUN 1975
1 FAMC @F2@
0 @F1@ FAM
1 HUSB @I1@
1 CHIL @I3@
0 @F2@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 MARR
2 DATE 5 SEP 1974
2 PLAC Bordeaux, France
1 CHIL @I3@
0 TRLR`

describe('parser GEDCOM', () => {
  it('parse les lignes correctement', () => {
    const lines = parseGedcomLines(SAMPLE_GEDCOM)
    expect(lines.length).toBeGreaterThan(10)
    expect(lines[0].tag).toBe('HEAD')
  })

  it('construit l\'arbre de records', () => {
    const lines = parseGedcomLines(SAMPLE_GEDCOM)
    const records = buildRecordTree(lines)
    expect(records.length).toBe(7) // HEAD, I1, I2, I3, F1, F2, TRLR
    expect(records[0].tag).toBe('HEAD')
  })

  it('extrait les individus et familles', () => {
    const tree = parseGedcom(SAMPLE_GEDCOM)
    expect(tree.indi.size).toBe(3)
    expect(tree.fam.size).toBe(2)

    const jean = tree.indi.get('@I1@')!
    expect(jean.names[0].given).toBe('Jean')
    expect(jean.names[0].surname).toBe('Dupont')
    expect(jean.sex).toBe('M')
    expect(jean.birth).toBeTruthy()
    expect(jean.birth!.place).toBe('Paris, France')
    expect(jean.death).toBeTruthy()
    expect(jean.fams).toContain('F2')
    expect(jean.famc).toContain('F1')

    const fam2 = tree.fam.get('@F2@')!
    expect(fam2.husb).toBe('I1')
    expect(fam2.wife).toBe('I2')
    expect(fam2.children).toContain('I3')
    expect(fam2.marr).toBeTruthy()
    expect(fam2.marr!.place).toBe('Bordeaux, France')
  })

  it('gère les dates approximatives (ABT)', () => {
    const tree = parseGedcom(SAMPLE_GEDCOM)
    const marie = tree.indi.get('@I2@')!
    expect(marie.birth!.date!.qualifier).toBe('about')
  })
})
