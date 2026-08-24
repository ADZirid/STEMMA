// Utilitaires de test : construction d'un graphe en mémoire
// (sans base de données ni Tauri).
import type { RelGraph } from './engine'

export interface NodeSpec {
  parents: string[]
}

export interface PartnerSpec {
  a: string
  b: string
  status: string
}

export function buildTestGraph(
  people: Record<string, NodeSpec>,
  partners: PartnerSpec[] = [],
): RelGraph {
  const g: RelGraph = {
    parents: new Map(),
    children: new Map(),
    partners: new Map(),
    unionsOfChild: new Map(),
  }
  for (const [childId, spec] of Object.entries(people)) {
    for (const parentId of spec.parents) {
      if (!g.parents.has(childId)) g.parents.set(childId, [])
      const list = g.parents.get(childId)!
      if (!list.some((p) => p.parent_id === parentId)) {
        list.push({ parent_id: parentId, type: 'biologique', via: 'direct' })
      }
      if (!g.children.has(parentId)) g.children.set(parentId, new Set())
      g.children.get(parentId)!.add(childId)
    }
  }
  partners.forEach((p, i) => {
    const uid = `u${i}`
    for (const x of [p.a, p.b]) {
      const other = x === p.a ? p.b : p.a
      if (!g.partners.has(x)) g.partners.set(x, [])
      g.partners.get(x)!.push({ union_id: uid, other_id: other, status: p.status })
    }
  })
  return g
}