// Tests du moteur de relations — les relations (demi-frère, etc.)
// doivent être calculées, jamais stockées.
import { describe, it, expect } from 'vitest'
import { siblingsOf, relationshipBetween, ancestors } from './engine'
import { buildTestGraph } from './engine.test-utils'

describe('moteur de relations', () => {
  it('demi-frères : un seul parent commun (Marie)', () => {
    const g = buildTestGraph({
      jean: { parents: [] },
      marie: { parents: [] },
      paul: { parents: ['marie'] },
      thomas: { parents: ['marie'] },
    })
    const s = siblingsOf(g, 'paul')
    expect(s.half).toContain('thomas')
    expect(s.full).not.toContain('thomas')
  })

  it('frères pleins : deux parents communs', () => {
    const g = buildTestGraph({
      paul: { parents: ['jean', 'marie'] },
      claire: { parents: ['jean', 'marie'] },
    })
    const s = siblingsOf(g, 'paul')
    expect(s.full).toContain('claire')
    expect(s.half).not.toContain('claire')
  })

  it('conjoint(e) et ex-conjoint(e)', () => {
    const g = buildTestGraph({}, [
      { a: 'jean', b: 'marie', status: 'actuel' },
      { a: 'paul', b: 'sophie', status: 'divorce' },
    ])
    expect(relationshipBetween(g, 'jean', 'marie').kind).toBe('conjoint')
    expect(relationshipBetween(g, 'paul', 'sophie').kind).toBe('ex-conjoint')
  })

  it('parent / grand-parent / petit-enfant', () => {
    const g = buildTestGraph({
      jean: { parents: [] },
      marie: { parents: [] },
      paul: { parents: ['jean', 'marie'] },
      claire: { parents: ['paul'] },
    })
    expect(relationshipBetween(g, 'jean', 'paul').kind).toBe('parent')
    expect(relationshipBetween(g, 'paul', 'jean').kind).toBe('enfant')
    expect(relationshipBetween(g, 'jean', 'claire').kind).toBe('ancêtre')
    expect(relationshipBetween(g, 'claire', 'jean').kind).toBe('descendant')
  })

  it('oncle/neveu et cousins', () => {
    const g = buildTestGraph({
      jean: { parents: [] },
      marie: { parents: [] },
      anne: { parents: ['jean', 'marie'] },
      paul: { parents: ['jean', 'marie'] },
      luc: { parents: ['anne'] },
      clea: { parents: ['paul'] },
    })
    expect(relationshipBetween(g, 'paul', 'luc').kind).toBe('oncle')
    expect(relationshipBetween(g, 'luc', 'paul').kind).toBe('neveu')
    expect(relationshipBetween(g, 'luc', 'clea').kind).toBe('cousin')
  })

  it('ancêtres de profondeur', () => {
    const g = buildTestGraph({
      a: { parents: [] },
      b: { parents: ['a'] },
      c: { parents: ['b'] },
      d: { parents: ['c'] },
    })
    expect(ancestors(g, 'd').get('a')).toBe(3)
    expect(ancestors(g, 'd').get('b')).toBe(2)
    expect(ancestors(g, 'd').get('c')).toBe(1)
  })

  it('plusieurs unions : jean est conjoint de marie et ex de sophie', () => {
    const g = buildTestGraph({
      jean: { parents: [] },
      marie: { parents: [] },
      sophie: { parents: [] },
      paul: { parents: ['jean', 'sophie'] },
    }, [
      { a: 'jean', b: 'marie', status: 'actuel' },
      { a: 'jean', b: 'sophie', status: 'divorce' },
    ])
    expect(relationshipBetween(g, 'jean', 'marie').kind).toBe('conjoint')
    expect(relationshipBetween(g, 'jean', 'sophie').kind).toBe('ex-conjoint')
    expect(relationshipBetween(g, 'jean', 'paul').kind).toBe('parent')
  })

  it('parent adoptif', () => {
    const g = buildTestGraph({
      luc: { parents: ['jean'] },
    }, [
      { a: 'jean', b: 'marie', status: 'actuel' },
    ])
    // Marie est la belle-mère de luc (pas adoptive ici, car le lien est via union)
    // luc n'a que jean comme parent direct
    expect(relationshipBetween(g, 'jean', 'luc').kind).toBe('parent')
    expect(relationshipBetween(g, 'luc', 'jean').kind).toBe('enfant')
  })

  it('beau-parent / beau-enfant', () => {
    const g = buildTestGraph({
      jean: { parents: [] },
      marie: { parents: [] },
      paul: { parents: ['jean', 'marie'] },
      sophie: { parents: [] },
      luc: { parents: ['paul'] },
    }, [
      { a: 'jean', b: 'marie', status: 'actuel' },
      { a: 'sophie', b: 'paul', status: 'actuel' },
    ])
    // Sophie est la belle-mère de luc (elle est partenaire de paul, parent de luc)
    const rel = relationshipBetween(g, 'sophie', 'luc')
    expect(rel.kind).toBe('beau-parent')
  })
})