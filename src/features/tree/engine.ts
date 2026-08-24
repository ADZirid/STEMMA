// ---------------------------------------------------------------------------
// MOTEUR DE RELATIONS — les relations ne sont JAMAIS stockées :
// elles sont calculées dynamiquement à partir des unions et des parents.
// Extensible : chaque cas est une fonction pure sur le graphe familial.
// ---------------------------------------------------------------------------
import {
  listAllUnions,
  listAllUnionPartners,
  listParentLinks,
  listChildLinks,
} from '@/database/repositories/unionRepo'
import type { RelationshipType, Sex } from '@/types'

export interface ParentEdge {
  parent_id: string
  type: RelationshipType
  via: 'union' | 'direct'
}

export interface UnionEdge {
  union_id: string
  other_id: string
  status: string
}

export interface RelGraph {
  /** child_id -> liens vers ses parents (dédupliqués par parent) */
  parents: Map<string, ParentEdge[]>
  /** parent_id -> enfants */
  children: Map<string, Set<string>>
  /** person_id -> partenaires (avec statut d'union) */
  partners: Map<string, UnionEdge[]>
  /** child_id -> unions le concernant */
  unionsOfChild: Map<string, string[]>
}

// ---------------------------------------------------------------------------
// Construction du graphe depuis la base (données 100% locales).
// ---------------------------------------------------------------------------

export async function buildRelGraph(projectId: string): Promise<RelGraph> {
  const [unions, parentLinks, childLinks, allPartners] = await Promise.all([
    listAllUnions(projectId),
    listParentLinks(projectId),
    listChildLinks(projectId),
    listAllUnionPartners(projectId),
  ])

  const g: RelGraph = {
    parents: new Map(),
    children: new Map(),
    partners: new Map(),
    unionsOfChild: new Map(),
  }

  const addParent = (childId: string, parentId: string, type: RelationshipType, via: 'union' | 'direct') => {
    if (!g.parents.has(childId)) g.parents.set(childId, [])
    const list = g.parents.get(childId)!
    if (!list.some((p) => p.parent_id === parentId)) {
      list.push({ parent_id: parentId, type, via })
    }
    if (!g.children.has(parentId)) g.children.set(parentId, new Set())
    g.children.get(parentId)!.add(childId)
  }

  // Liens directs (adoption, parent seul).
  for (const link of parentLinks) {
    addParent(link.child_id, link.parent_id, link.relationship_type, 'direct')
  }

  // Partenaires par union.
  const partnersByUnion = new Map<string, string[]>()
  for (const row of allPartners) {
    if (!partnersByUnion.has(row.union_id)) partnersByUnion.set(row.union_id, [])
    partnersByUnion.get(row.union_id)!.push(row.person_id)
  }

  // Enfants par union -> chaque partenaire est un parent.
  for (const link of childLinks) {
    if (!g.unionsOfChild.has(link.child_id)) g.unionsOfChild.set(link.child_id, [])
    const list = g.unionsOfChild.get(link.child_id)!
    if (!list.includes(link.union_id)) list.push(link.union_id)
    const partners = partnersByUnion.get(link.union_id) ?? []
    for (const pid of partners) {
      addParent(link.child_id, pid, link.relationship_type, 'union')
    }
  }

  // Partenaires : a ET b sont partenaires si une union les liste ensemble.
  const statusById = new Map<string, string>()
  for (const u of unions) statusById.set(u.id, u.status)
  for (const u of unions) {
    const members = partnersByUnion.get(u.id) ?? []
    for (const pid of members) {
      if (!g.partners.has(pid)) g.partners.set(pid, [])
      const list = g.partners.get(pid)!
      for (const other of members) {
        if (other === pid) continue
        if (!list.some((e) => e.other_id === other)) {
          list.push({ union_id: u.id, other_id: other, status: u.status })
        }
      }
    }
  }
  void statusById
  return g
}

// ---------------------------------------------------------------------------
// Requêtes courantes sur le graphe.
// ---------------------------------------------------------------------------

export function parentsOf(g: RelGraph, id: string): ParentEdge[] {
  return g.parents.get(id) ?? []
}

export function childrenOf(g: RelGraph, id: string): Set<string> {
  return g.children.get(id) ?? new Set()
}

export function partnersOf(g: RelGraph, id: string): UnionEdge[] {
  return g.partners.get(id) ?? []
}

/** Frères/sœurs : pleins (2 parents communs) ou demis (1 parent commun). */
export function siblingsOf(g: RelGraph, id: string): { full: string[]; half: string[] } {
  const mine = new Set(parentsOf(g, id).map((p) => p.parent_id))
  const full: string[] = []
  const half: string[] = []
  if (mine.size === 0) return { full, half }
  for (const otherId of g.parents.keys()) {
    if (otherId === id) continue
    const theirs = new Set(parentsOf(g, otherId).map((p) => p.parent_id))
    const common = [...mine].filter((p) => theirs.has(p)).length
    if (common >= 2) full.push(otherId)
    else if (common === 1) half.push(otherId)
  }
  return { full, half }
}

/** Ancêtres avec profondeur (plus courte distance). */
export function ancestors(g: RelGraph, id: string): Map<string, number> {
  const res = new Map<string, number>()
  const visit = (pid: string, depth: number) => {
    for (const p of parentsOf(g, pid)) {
      const prev = res.get(p.parent_id)
      if (prev === undefined || depth < prev) {
        res.set(p.parent_id, depth)
        visit(p.parent_id, depth + 1)
      }
    }
  }
  visit(id, 1)
  return res
}

/** Nombre de petits-enfants (pour statistiques). */
export function grandchildrenCount(g: RelGraph, id: string): number {
  let n = 0
  for (const c of childrenOf(g, id)) {
    n += childrenOf(g, c).size
  }
  return n
}

// ---------------------------------------------------------------------------
// Étiquetage des relations.
// ---------------------------------------------------------------------------

export interface RelLabel {
  from: string
  to: string
  kind: string
}

const SEX_NOM: Record<Sex, string> = { M: 'père', F: 'mère', X: 'parent', '': 'parent' }
const SEX_SIBLING: Record<Sex, string> = { M: 'frère', F: 'sœur', X: 'frère/sœur', '': 'frère/sœur' }
const SEX_AUNT: Record<Sex, string> = { M: 'oncle', F: 'tante', X: 'oncle/tante', '': 'oncle/tante' }
const SEX_NEPHEW: Record<Sex, string> = { M: 'neveu', F: 'nièce', X: 'neveu/nièce', '': 'neveu/nièce' }
const SEX_CHILD: Record<Sex, string> = { M: 'fils', F: 'fille', X: 'enfant', '': 'enfant' }

export function relationshipBetween(
  g: RelGraph,
  aId: string,
  bId: string,
  sexA?: Sex,
): RelLabel {
  if (aId === bId) return { from: 'soi-même', to: 'soi-même', kind: 'self' }
  const sA = sexA ?? 'X'
  const sB: Sex = 'X'

  // --- conjoints / partenaires (y compris ex-) ----------------------------
  const withB = (g.partners.get(aId) ?? []).filter((e) => e.other_id === bId)
  if (withB.length > 0) {
    const open = withB.some((e) => e.status === 'actuel')
    const closed = withB.some((e) => e.status !== 'actuel')
    if (open && !closed) return { from: 'conjoint(e)', to: 'conjoint(e)', kind: 'conjoint' }
    if (open && closed) return { from: 'conjoint(e) / ex', to: 'conjoint(e) / ex', kind: 'conjoint-ex' }
    return { from: 'ex-conjoint(e)', to: 'ex-conjoint(e)', kind: 'ex-conjoint' }
  }

  // --- parent → enfant ------------------------------------------------------
  if (childrenOf(g, aId).has(bId)) {
    const edge = g.parents.get(bId)?.find((p) => p.parent_id === aId)
    const isAdoptive = edge?.type === 'adopte'
    const nom = SEX_NOM[sA]
    const label = isAdoptive ? `${nom} adoptif` : nom
    return { from: label, to: SEX_CHILD[sB], kind: 'parent' }
  }
  if (childrenOf(g, bId).has(aId)) {
    const edge = g.parents.get(aId)?.find((p) => p.parent_id === bId)
    const isAdoptive = edge?.type === 'adopte'
    const nom = SEX_NOM[sB]
    const label = isAdoptive
      ? `${nom} adoptif`
      : nom
    return { from: SEX_CHILD[sA], to: label, kind: 'enfant' }
  }

  const ancB = ancestors(g, bId)
  const ancA = ancestors(g, aId)
  // Si aId est ancêtre de bId : on qualifie aId.
  const daUp = ancB.get(aId)
  if (daUp !== undefined) return ancestorLabel(sA, sB, daUp)
  // Si bId est ancêtre de aId : on qualifie aId comme descendant.
  const dbDown = ancA.get(bId)
  if (dbDown !== undefined) return descendantLabel(sA, sB, dbDown)

  // --- collatéraux par ancêtre commun -------------------------------------
  const shared: string[] = []
  for (const k of ancA.keys()) if (ancB.has(k)) shared.push(k)
  if (shared.length > 0) {
    let best: string = shared[0]
    for (const k of shared) {
      if (ancA.get(k)! + ancB.get(k)! < ancA.get(best)! + ancB.get(best)!) best = k
    }
    const daa = ancA.get(best)!
    const dbb = ancB.get(best)!
    if (daa === 1 && dbb === 1) {
      const half = siblingsOf(g, aId).half.includes(bId)
      const label = half
        ? `demi-${SEX_SIBLING[sA]}`
        : SEX_SIBLING[sA]
      const labelB = half ? `demi-${SEX_SIBLING[sB]}` : SEX_SIBLING[sB]
      return { from: label, to: labelB, kind: half ? 'demi-fratrie' : 'fratrie' }
    }
    if (daa === 1 && dbb === 2) return { from: SEX_AUNT[sA], to: SEX_NEPHEW[sB], kind: 'oncle' }
    if (daa === 2 && dbb === 1) return { from: SEX_NEPHEW[sA], to: SEX_AUNT[sB], kind: 'neveu' }
    const deg = Math.max(daa, dbb) - 2
    const cousin = deg <= 1 ? 'cousin·e germain·e' : `cousin·e au ${deg}e degré`
    return { from: cousin, to: cousin, kind: 'cousin' }
  }

  // --- belles-familles (recomposées) ---------------------------------------
  const step = stepRelation(g, aId, bId)
  if (step) return step

  return { from: 'lien de famille', to: 'lien de famille', kind: 'autre' }
}

function ancestorLabel(sexA: Sex, sexB: Sex, depth: number): RelLabel {
  const s =
    depth === 1
      ? SEX_NOM[sexA]
      : depth === 2
        ? `grand-${SEX_NOM[sexA]}`
        : `${'arrière-'.repeat(depth - 2)}grand-${SEX_NOM[sexA]}`
  const t = depth === 1 ? SEX_CHILD[sexB] : depth === 2 ? 'petit-enfant' : `${'arrière-'.repeat(depth - 2)}petit-enfant`
  return { from: s, to: t, kind: 'ancêtre' }
}

function descendantLabel(sexA: Sex, sexB: Sex, depth: number): RelLabel {
  const t =
    depth === 1
      ? SEX_CHILD[sexB]
      : depth === 2
        ? 'petit-enfant'
        : `${'arrière-'.repeat(depth - 2)}petit-enfant`
  const s = depth === 1 ? SEX_NOM[sexA] : 'ascendant·e'
  return { from: s, to: t, kind: 'descendant' }
}

function stepRelation(g: RelGraph, aId: string, bId: string): RelLabel | null {
  // partenaire d'un parent de b
  for (const p of parentsOf(g, bId)) {
    if ((g.partners.get(p.parent_id) ?? []).some((e) => e.other_id === aId)) {
      return { from: 'beau-parent', to: 'beau-fils / beau-enfant', kind: 'beau-parent' }
    }
  }
  // partenaire de a est un parent de b (vue inverse) -> beau-parent pour b
  const partnersA = g.partners.get(aId) ?? []
  if (partnersA.some((pa) => parentsOf(g, bId).some((p) => p.parent_id === pa.other_id))) {
    return { from: 'beau-fils / beau-enfant', to: 'beau-parent', kind: 'beau-parent' }
  }
  // enfant du partenaire de b (beau-fils / belle-fille)
  if (partnersA.some((pa) => childrenOf(g, pa.other_id).has(bId))) {
    return { from: 'beau-père / belle-mère', to: 'beau-fils / beau-enfant', kind: 'beau-parent' }
  }
  const partnersB = g.partners.get(bId) ?? []
  if (partnersB.some((pb) => childrenOf(g, pb.other_id).has(aId))) {
    return { from: 'beau-fils / beau-enfant', to: 'beau-père / belle-mère', kind: 'beau-child' }
  }
  // fratrie par parent partagé (relation non biologique d'un côté)
  if (parentsOf(g, aId).some((pa) => parentsOf(g, bId).some((pb) => pb.parent_id === pa.parent_id))) {
    return { from: 'frère / sœur', to: 'frère / sœur', kind: 'fratrie' }
  }
  return null
}