// ---------------------------------------------------------------------------
// Tests de la mise en page de l'arbre (fonction pure, sans Tauri).
// ---------------------------------------------------------------------------
import { describe, it, expect } from 'vitest'
import { buildTreeLayout, type TreeContext } from './layout'
import type { PersonDated, UnionFamily } from '@/types'

function person(id: string, surname = 'X'): PersonDated {
  return {
    id,
    given_name: `${id}g`,
    surname,
    birth_name: '',
    sex: 'M',
    profession: '',
    description: '',
    notes: '',
    photo_id: '',
    created_at: '',
    updated_at: '',
    deleted_at: null,
    birth: { date: null, place: '' },
    death: { date: null, place: '' },
  }
}

function union(id: string): UnionFamily {
  return {
    id, type: 'union', status: 'actuel', start_date_id: null, end_date_id: null,
    place: '', notes: '', created_at: '', updated_at: '', deleted_at: null,
  }
}

interface BuildOpts {
  unions?: { id: string; partners: string[]; children: string[] }[]
  expanded?: string[]
  expandedParents?: string[]
  parentLinks?: { parent_id: string; child_id: string }[]
}

function ctx(rootId: string, peopleIds: string[], opts: BuildOpts): TreeContext {
  const people = new Map(peopleIds.map((id) => [id, person(id)]))
  const unionData = new Map<string, { union: UnionFamily; partners: string[]; children: { child_id: string; relationship_type: 'biologique' }[] }>()
  for (const u of opts.unions ?? []) {
    unionData.set(u.id, {
      union: union(u.id),
      partners: u.partners,
      children: u.children.map((child_id) => ({ child_id, relationship_type: 'biologique' as const })),
    })
  }
  const unionsOf = new Map<string, string[]>()
  for (const u of opts.unions ?? []) {
    for (const p of u.partners) {
      const list = unionsOf.get(p) ?? []
      list.push(u.id)
      unionsOf.set(p, list)
    }
  }
  const parentLinks = new Map<string, { parent_id: string; type: 'biologique' }[]>()
  for (const l of opts.parentLinks ?? []) {
    const list = parentLinks.get(l.child_id) ?? []
    list.push({ parent_id: l.parent_id, type: 'biologique' })
    parentLinks.set(l.child_id, list)
  }
  return {
    rootId,
    people,
    unionsOf,
    unionData,
    expandedUnions: new Set(opts.expanded ?? []),
    expandedParents: new Set(opts.expandedParents ?? []),
    parentLinks,
  }
}

const ROW = 200
const DROP = 74

describe('buildTreeLayout', () => {
  it('place la racine et centre un unique enfant sous l’union', () => {
    const c = ctx('A', ['A', 'C'], {
      unions: [{ id: 'u1', partners: ['A', 'B'], children: ['C'] }],
      expanded: ['u1'],
    })
    const { nodes, edges } = buildTreeLayout(c)
    const a = nodes.find((n) => n.id === 'A')!
    const u = nodes.find((n) => n.type === 'union')!
    const ch = nodes.find((n) => n.id === 'C')!
    expect(ch.position.y).toBe(ROW)
    expect(u.position.y).toBe(a.position.y + DROP)
    expect(Math.abs(u.position.x - ch.position.x)).toBeLessThanOrEqual(1)
    expect(edges.some((e) => e.source === 'A' && e.target === u.id)).toBe(true)
    expect(edges.some((e) => e.source === u.id && e.target === 'C')).toBe(true)
  })

  it('aligne deux enfants sur la même génération', () => {
    const c = ctx('A', ['A', 'C', 'D'], {
      unions: [{ id: 'u1', partners: ['A', 'B'], children: ['C', 'D'] }],
      expanded: ['u1'],
    })
    const { nodes } = buildTreeLayout(c)
    const ch1 = nodes.find((n) => n.id === 'C')!
    const ch2 = nodes.find((n) => n.id === 'D')!
    expect(ch1.position.y).toBe(ch2.position.y)
    expect(ch1.position.x).not.toBe(ch2.position.x)
  })

  it('affiche le partenaire (non-ancre) à la même génération', () => {
    const c = ctx('A', ['A', 'B', 'C'], {
      unions: [{ id: 'u1', partners: ['A', 'B'], children: ['C'] }],
      expanded: ['u1'],
    })
    const { nodes, edges } = buildTreeLayout(c)
    const partner = nodes.find((n) => n.id === 'p:u1:B')
    expect(partner).toBeDefined()
    if (partner) {
      const a = nodes.find((n) => n.id === 'A')!
      expect(partner.position.y).toBe(a.position.y)
      expect(edges.some((e) => e.source === 'u:u1' && e.target === 'p:u1:B')).toBe(true)
    }
  })

  it('masque les enfants d’une union repliée', () => {
    const c = ctx('A', ['A', 'C'], {
      unions: [{ id: 'u1', partners: ['A', 'B'], children: ['C'] }],
      expanded: [],
    })
    const { nodes } = buildTreeLayout(c)
    expect(nodes.some((n) => n.id === 'C')).toBe(false)
  })

  it('affiche plusieuurs conjoints et leurs enfants (multi-unions)', () => {
    const c = ctx('A', ['A', 'B', 'C', 'D', 'E'], {
      unions: [
        { id: 'u1', partners: ['A', 'B'], children: ['C'] },
        { id: 'u2', partners: ['A', 'D'], children: ['E'] },
      ],
      expanded: ['u1', 'u2'],
    })
    const { nodes, edges } = buildTreeLayout(c)
    expect(nodes.some((n) => n.id === 'p:u1:B')).toBe(true)
    expect(nodes.some((n) => n.id === 'p:u2:D')).toBe(true)
    expect(edges.filter((e) => e.source === 'A').length).toBeGreaterThanOrEqual(2)
  })

  it('affiche les parents demandés au-dessus d’un enfant', () => {
    const c = ctx('A', ['A', 'P1', 'P2', 'C'], {
      unions: [{ id: 'u1', partners: ['A', 'B'], children: ['C'] }],
      expanded: ['u1'],
      expandedParents: ['A'],
      parentLinks: [
        { parent_id: 'P1', child_id: 'A' },
        { parent_id: 'P2', child_id: 'A' },
      ],
    })
    const { nodes } = buildTreeLayout(c)
    const p1 = nodes.find((n) => n.id === 'parent:A:0')
    const p2 = nodes.find((n) => n.id === 'parent:A:1')
    expect(p1).toBeDefined()
    expect(p2).toBeDefined()
    const a = nodes.find((n) => n.id === 'A')!
    if (p1 && p2) {
      expect(p1.position.y).toBeLessThan(a.position.y)
      expect(p2.position.y).toBe(p1.position.y)
    }
  })

  describe('ancestor layout', () => {
    it('place la racine en bas et les parents au-dessus', () => {
      const c = ctx('A', ['A', 'P1', 'P2'], {
        parentLinks: [
          { parent_id: 'P1', child_id: 'A' },
          { parent_id: 'P2', child_id: 'A' },
        ],
      })
      const { nodes, edges } = buildTreeLayout(c, 'ancestor')
      const a = nodes.find((n) => n.id === 'A')!
      const p1 = nodes.find((n) => n.id === 'P1')!
      const p2 = nodes.find((n) => n.id === 'P2')!
      expect(a).toBeDefined()
      expect(p1).toBeDefined()
      expect(p2).toBeDefined()
      // Parents au-dessus de la racine (y plus petit)
      expect(p1.position.y).toBeLessThan(a.position.y)
      expect(p2.position.y).toBeLessThan(a.position.y)
      expect(p2.position.y).toBe(p1.position.y)
      // Edges parent → enfant
      expect(edges.some((e) => e.source === 'A' && e.target === 'P1')).toBe(true)
      expect(edges.some((e) => e.source === 'A' && e.target === 'P2')).toBe(true)
    })

    it('génère trois générations d\'ascendants', () => {
      const c = ctx('A', ['A', 'P1', 'P2', 'GP1', 'GP2'], {
        parentLinks: [
          { parent_id: 'P1', child_id: 'A' },
          { parent_id: 'P2', child_id: 'A' },
          { parent_id: 'GP1', child_id: 'P1' },
          { parent_id: 'GP2', child_id: 'P1' },
        ],
      })
      const { nodes } = buildTreeLayout(c, 'ancestor')
      const a = nodes.find((n) => n.id === 'A')!
      const p1 = nodes.find((n) => n.id === 'P1')!
      const gp1 = nodes.find((n) => n.id === 'GP1')!
      expect(gp1.position.y).toBeLessThan(p1.position.y)
      expect(p1.position.y).toBeLessThan(a.position.y)
    })
  })
})