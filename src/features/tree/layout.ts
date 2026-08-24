// ---------------------------------------------------------------------------
// MISE EN PAGE DE L'ARBRE — génère les nœuds/arêtes React Flow à partir
// d'un projet. Rendu limité aux branches visibles (aucune surcharge DOM).
// ---------------------------------------------------------------------------
import type { PersonDated, UnionFamily, RelationshipType } from '@/types'

export interface TreeUnion {
  union: UnionFamily
  partners: string[] // ids (y compris l'ancre de l'union)
  children: { child_id: string; relationship_type: RelationshipType }[]
}

export interface TreeContext {
  rootId: string
  people: Map<string, PersonDated>
  unionsOf: Map<string, string[]> // personId -> unions où la personne est partenaire
  unionData: Map<string, TreeUnion>
  expandedUnions: Set<string> // unions dépliées (enfants affichés)
  expandedParents: Set<string> // personnes dont les parents sont affichés
  parentLinks: Map<string, { parent_id: string; type: RelationshipType }[]>
}

interface TNode {
  personId: string | null
  gen: number
  unions: string[]
  collapsedUnions: string[]
  isRef: boolean
  isParentSlot?: boolean
}

const ROW_GAP = 200
const COL_GAP = 200
const UNION_DROP = 74
const PARTNER_OFFSET = 150
const PARENT_OFFSET = 140

export interface LayoutNodeData {
  type: 'person' | 'union' | 'parentSlot'
  person?: PersonDated
  union?: TreeUnion
  gen: number
  isRoot?: boolean
  isCollapsed?: boolean
  expandable?: boolean
  expandableChildren?: number
  partnerCount?: number
  onExpand?: (personId: string) => void
  onCollapse?: (personId: string) => void
  onOpen?: (personId: string) => void
  onToggleParents?: (personId: string) => void
  [key: string]: unknown
}

export interface LayoutNode {
  id: string
  type: 'person' | 'union' | 'parentSlot'
  data: LayoutNodeData
  position: { x: number; y: number }
}

export interface LayoutEdge {
  id: string
  source: string
  target: string
  type?: string
}

export interface LayoutResult {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
}

export type TreeDirection = 'descendant' | 'ancestor'

// ---------------------------------------------------------------------------

export function buildTreeLayout(ctx: TreeContext, direction: TreeDirection = 'descendant'): LayoutResult {
  const { people, rootId } = ctx
  const root = people.get(rootId)
  if (!root) return { nodes: [], edges: [] }

  if (direction === 'ancestor') {
    return buildAncestorLayout(ctx)
  }

  // --- Mode descendant (originel) --------------------------------------------

  const placed = new Set<string>([rootId])
  const nodeKeys = new Map<string, TNode>()
  const finalNodes = new Map<string, LayoutNode>()
  const edges: LayoutEdge[] = []
  const edgeIds = new Set<string>()
  const positions = new Map<string, { x: number; y: number }>()

  const addEdge = (s: string, t: string) => {
    const id = `${s}--${t}`
    if (edgeIds.has(id)) return
    edgeIds.add(id)
    edges.push({ id, source: s, target: t })
  }

  // ---- Construction de l'arbre (personnes + unions) ------------------------
  function expand(personId: string, gen: number): void {
    if (nodeKeys.has(personId)) return
    const unionIds = ctx.unionsOf.get(personId) ?? []
    const expanded = unionIds.filter((u) => ctx.expandedUnions.has(u))
    const collapsed = unionIds.filter((u) => !expanded.includes(u))
    nodeKeys.set(personId, { personId, gen, unions: expanded, collapsedUnions: collapsed, isRef: false })

    for (const uid of expanded) {
      const tu = ctx.unionData.get(uid)
      if (!tu) continue
      for (const child of tu.children) {
        if (placed.has(child.child_id)) {
          if (!nodeKeys.has(`ref:${child.child_id}`)) {
            nodeKeys.set(`ref:${child.child_id}`, {
              personId: child.child_id,
              gen: gen + 1,
              unions: [],
              collapsedUnions: [],
              isRef: true,
            })
          }
          continue
        }
        placed.add(child.child_id)
        expand(child.child_id, gen + 1)
      }
    }
  }

  placed.delete(rootId)
  expand(rootId, 0)

  // ---- Parents (au-dessus) si demandé ---------------------------------------
  for (const pid of ctx.expandedParents) {
    const links = ctx.parentLinks.get(pid) ?? []
    if (links.length === 0) continue
    const gen = nodeKeys.get(pid)?.gen ?? 0
    if (!nodeKeys.has(`parentSlot:${pid}`)) {
      nodeKeys.set(`parentSlot:${pid}`, {
        personId: pid,
        gen: gen - 1,
        unions: [],
        collapsedUnions: [],
        isRef: true,
        isParentSlot: true,
      })
    }
    links.forEach((l, i) => {
      const key = `parent:${pid}:${i}`
      if (!nodeKeys.has(key)) {
        nodeKeys.set(key, {
          personId: l.parent_id,
          gen: gen - 1,
          unions: [],
          collapsedUnions: [],
          isRef: true,
        })
      }
    })
  }

  // ---- Feuilles et slots horizontaux ----------------------------------------
  let slot = 0
  const leafIndex = new Map<string, number>()

  function childKey(childId: string): string | null {
    if (nodeKeys.has(childId)) return childId
    const ref = `ref:${childId}`
    if (nodeKeys.has(ref)) return ref
    return null
  }

  function assignSlots(id: string): { min: number; max: number } {
    const node = nodeKeys.get(id)
    if (!node) return { min: 0, max: 0 }
    if (!node.isRef && node.unions.length === 0) {
      if (!leafIndex.has(id)) leafIndex.set(id, slot++)
      const i = leafIndex.get(id)!
      return { min: i, max: i }
    }
    let min = Infinity
    let max = -Infinity
    for (const uid of node.unions) {
      const tu = ctx.unionData.get(uid)
      if (!tu) continue
      for (const child of tu.children) {
        const key = childKey(child.child_id)
        if (key) {
          const r = assignSlots(key)
          min = Math.min(min, r.min)
          max = Math.max(max, r.max)
        }
      }
    }
    if (min === Infinity) {
      if (!leafIndex.has(id)) leafIndex.set(id, slot++)
      const i = leafIndex.get(id)!
      return { min: i, max: i }
    }
    return { min, max }
  }

  assignSlots(rootId)

  function placeNode(id: string): { x: number; y: number } {
    const cached = positions.get(id)
    if (cached) return cached
    const node = nodeKeys.get(id)
    if (!node) return { x: 0, y: 0 }
    const li = leafIndex.get(id)
    let x: number
    if (li !== undefined) {
      x = li * COL_GAP
    } else {
      let min = Infinity
      let max = -Infinity
      for (const uid of node.unions) {
        const tu = ctx.unionData.get(uid)
        if (!tu) continue
        for (const child of tu.children) {
          const key = childKey(child.child_id)
          if (key) {
            const r = placeNode(key)
            min = Math.min(min, r.x)
            max = Math.max(max, r.x)
          }
        }
      }
      x = min === Infinity ? 0 : (min + max) / 2
    }
    const pos = { x, y: node.gen * ROW_GAP }
    positions.set(id, pos)
    return pos
  }

  // Position des parents : au-dessus de l'enfant, espacés.
  for (const pid of ctx.expandedParents) {
    const links = ctx.parentLinks.get(pid) ?? []
    if (links.length === 0) continue
    const childPos = positions.get(pid)
    if (!childPos) continue
    const slotKey = `parentSlot:${pid}`
    positions.set(slotKey, { x: childPos.x, y: childPos.y - ROW_GAP })
    const n = links.length
    links.forEach((_l, i) => {
      positions.set(`parent:${pid}:${i}`, {
        x: childPos.x + (i - (n - 1) / 2) * PARENT_OFFSET,
        y: childPos.y - ROW_GAP,
      })
    })
  }

  for (const id of nodeKeys.keys()) placeNode(id)

  // ---- Création des nœuds React Flow ---------------------------------------
  const pushPerson = (id: string, person: PersonDated, extra: LayoutNodeData, pos: { x: number; y: number }) => {
    finalNodes.set(id, {
      id,
      type: 'person',
      data: { person, ...extra },
      position: pos,
    })
  }

  const pushUnion = (id: string, union: TreeUnion, gen: number, pos: { x: number; y: number }) => {
    finalNodes.set(id, {
      id,
      type: 'union',
      data: { type: 'union', union, gen },
      position: pos,
    })
  }

  // Personnes principales
  for (const [id, node] of nodeKeys) {
    if (node.isParentSlot) continue
    if (id.startsWith('parent:') && !id.startsWith('parentSlot:')) continue
    if (!node.personId) continue
    const person = people.get(node.personId)
    if (!person) continue
    const unionIds = [...node.unions, ...node.collapsedUnions]
    const totalChildren = unionIds.reduce((n, uid) => n + (ctx.unionData.get(uid)?.children.length ?? 0), 0)
    pushPerson(id, person, {
      type: 'person',
      gen: node.gen,
      isRoot: node.personId === rootId && !node.isRef,
      isCollapsed: node.collapsedUnions.length > 0,
      expandable: node.unions.length > 0 || node.collapsedUnions.length > 0,
      expandableChildren: totalChildren,
      partnerCount: node.unions.length + node.collapsedUnions.length,
    }, positions.get(id)!)
  }

  // Nœuds parents (slot + personnes)
  for (const [id, node] of nodeKeys) {
    if (!node.isParentSlot) continue
    const pid = node.personId!
    finalNodes.set(id, {
      id,
      type: 'parentSlot',
      data: { type: 'parentSlot', gen: node.gen },
      position: positions.get(id)!,
    })
    const links = ctx.parentLinks.get(pid) ?? []
    links.forEach((l, i) => {
      const key = `parent:${pid}:${i}`
      const person = people.get(l.parent_id)
      if (person) {
        finalNodes.set(key, {
          id: key,
          type: 'person',
          data: { type: 'person', person, gen: node.gen, isCollapsed: true, expandable: false },
          position: positions.get(key)!,
        })
      }
      edges.push({ id: `${id}-${key}`, source: id, target: key })
    })
  }

  // ---- Arêtes personne <-> union / union -> enfant --------------------------
  for (const [id, node] of nodeKeys) {
    if (node.isRef || node.isParentSlot || id.startsWith('parent:')) continue
    const anchorPos = positions.get(id)
    if (!anchorPos) continue
    for (const uid of node.unions) {
      const tu = ctx.unionData.get(uid)
      if (!tu) continue
      const unionNodeId = `u:${uid}`
      const childPositions: { x: number }[] = []
      for (const child of tu.children) {
        const key = childKey(child.child_id)
        if (key) {
          const cp = positions.get(key)
          if (cp) childPositions.push(cp)
        }
      }
      const uc = childPositions.length
        ? childPositions.reduce((s, p) => s + p.x, 0) / childPositions.length
        : anchorPos.x
      const uPos = { x: uc, y: anchorPos.y + UNION_DROP }
      if (!positions.has(unionNodeId)) positions.set(unionNodeId, uPos)
      pushUnion(unionNodeId, tu, node.gen + 0.5, positions.get(unionNodeId)!)
      addEdge(id, unionNodeId)
      for (const child of tu.children) {
        const key = childKey(child.child_id)
        if (key) addEdge(unionNodeId, key)
      }
      // Partenaires autres que l'ancre : mêmes génération, à côté de l'union.
      const partners = tu.partners.filter((p) => p !== node.personId)
      partners.forEach((pid, i) => {
        const key = `p:${uid}:${pid}`
        if (positions.has(key) || finalNodes.has(key)) return
        const ppos = { x: positions.get(unionNodeId)!.x + (i + 1) * PARTNER_OFFSET, y: anchorPos.y }
        positions.set(key, ppos)
        const person = people.get(pid)
        if (!person) return
        finalNodes.set(key, {
          id: key,
          type: 'person',
          data: { type: 'person', person, gen: node.gen, isCollapsed: true, expandable: false, partnerCount: 0 },
          position: ppos,
        })
        addEdge(unionNodeId, key)
      })
    }
  }

  return { nodes: [...finalNodes.values()], edges }
}

// ---------------------------------------------------------------------------
// ANCESTOR LAYOUT : racine en bas, parents au-dessus, grands-parents plus haut.
// ---------------------------------------------------------------------------
function buildAncestorLayout(ctx: TreeContext): LayoutResult {
  const { people, rootId, parentLinks } = ctx
  const root = people.get(rootId)
  if (!root) return { nodes: [], edges: [] }

  const nodeMap = new Map<string, { personId: string; gen: number }>()
  const finalNodes = new Map<string, LayoutNode>()
  const edges: LayoutEdge[] = []
  const edgeIds = new Set<string>()
  const positions = new Map<string, { x: number; y: number }>()

  const addEdge = (s: string, t: string) => {
    const id = `${s}--${t}`
    if (edgeIds.has(id)) return
    edgeIds.add(id)
    edges.push({ id, source: s, target: t })
  }

  // --- Expand parents recursively -------------------------------------------
  function expandAncestors(personId: string, gen: number) {
    if (nodeMap.has(personId)) return
    const links = parentLinks.get(personId) ?? []
    nodeMap.set(personId, { personId, gen })
    for (const l of links) {
      expandAncestors(l.parent_id, gen - 1)
    }
  }
  expandAncestors(rootId, 0)

  // --- Slot assignment (leaf = person with no parents) ----------------------
  let slot = 0
  const leafIndex = new Map<string, number>()

  function assignSlots(pid: string): { min: number; max: number } {
    const node = nodeMap.get(pid)
    if (!node) return { min: 0, max: 0 }
    const links = parentLinks.get(pid) ?? []
    if (links.length === 0) {
      if (!leafIndex.has(pid)) leafIndex.set(pid, slot++)
      const i = leafIndex.get(pid)!
      return { min: i, max: i }
    }
    let min = Infinity
    let max = -Infinity
    for (const l of links) {
      const r = assignSlots(l.parent_id)
      min = Math.min(min, r.min)
      max = Math.max(max, r.max)
    }
    if (min === Infinity) {
      if (!leafIndex.has(pid)) leafIndex.set(pid, slot++)
      const i = leafIndex.get(pid)!
      return { min: i, max: i }
    }
    return { min, max }
  }
  assignSlots(rootId)

  // --- Place nodes ----------------------------------------------------------
  function placeNode(pid: string): { x: number; y: number } {
    const cached = positions.get(pid)
    if (cached) return cached
    const node = nodeMap.get(pid)
    if (!node) return { x: 0, y: 0 }
    const li = leafIndex.get(pid)
    let x: number
    if (li !== undefined) {
      x = li * COL_GAP
    } else {
      const links = parentLinks.get(pid) ?? []
      let min = Infinity
      let max = -Infinity
      for (const l of links) {
        const r = placeNode(l.parent_id)
        min = Math.min(min, r.x)
        max = Math.max(max, r.x)
      }
      x = min === Infinity ? 0 : (min + max) / 2
    }
    // gen 0 (root) at the bottom, parents above (negative Y)
    const pos = { x, y: node.gen * ROW_GAP }
    positions.set(pid, pos)
    return pos
  }
  placeNode(rootId)

  // --- Create React Flow nodes & edges --------------------------------------
  for (const [pid, node] of nodeMap) {
    const person = people.get(pid)
    if (!person) continue
    const pos = positions.get(pid)!

    finalNodes.set(pid, {
      id: pid,
      type: 'person',
      data: {
        type: 'person',
        person,
        gen: node.gen,
        isRoot: pid === rootId,
        isCollapsed: false,
        expandable: true,
        expandableChildren: 0,
        partnerCount: 0,
      },
      position: pos,
    })

    // Edges: person → parent
    const links = parentLinks.get(pid) ?? []
    for (const l of links) {
      if (nodeMap.has(l.parent_id)) {
        addEdge(pid, l.parent_id)
      }
    }
  }

  return { nodes: [...finalNodes.values()], edges }
}