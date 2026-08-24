// ---------------------------------------------------------------------------
// Hook qui charge les données d'un projet et produit le layout de l'arbre.
// ---------------------------------------------------------------------------
import { useEffect, useMemo, useState } from 'react'
import type { PersonDated, UnionFamily, RelationshipType } from '@/types'
import { getAllPeople } from '@/database/repositories/personRepo'
import {
  listAllUnions,
  listAllUnionPartners,
  listParentLinks,
  listChildLinks,
} from '@/database/repositories/unionRepo'
import { buildTreeLayout, type TreeContext, type TreeUnion, type LayoutResult, type TreeDirection } from './layout'

interface RawData {
  people: PersonDated[]
  unions: UnionFamily[]
  partners: { union_id: string; person_id: string }[]
  childLinks: { union_id: string; child_id: string; relationship_type: RelationshipType }[]
  links: { child_id: string; parent_id: string; relationship_type: RelationshipType }[]
}

export function useTreeData(
  projectId: string,
  rootId: string,
  expandedUnions: Set<string>,
  expandedParents: Set<string>,
  direction: TreeDirection = 'descendant',
): {
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  layout: LayoutResult
} {
  const [data, setData] = useState<RawData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!projectId) {
      setData(null)
      setLoading(false)
      return
    }
    let alive = true
    setData(null)
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const [people, unions, partners, childLinks, links] = await Promise.all([
          getAllPeople(projectId),
          listAllUnions(projectId),
          listAllUnionPartners(projectId),
          listChildLinks(projectId),
          listParentLinks(projectId),
        ])
        if (!alive) return
        setData({ people, unions, partners, childLinks, links })
        setLoading(false)
      } catch (e) {
        if (alive) {
          setError(String(e))
          setLoading(false)
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [projectId, tick])

  const reload = async () => setTick((t) => t + 1)

  const context = useMemo<TreeContext | null>(() => {
    if (!rootId || !data || !data.people.length) return null
    const peopleMap = new Map(data.people.map((p) => [p.id, p]))
    const unionsOf = new Map<string, string[]>()
    const unionData = new Map<string, TreeUnion>()

    for (const u of data.unions) {
      unionData.set(u.id, { union: u, partners: [], children: [] })
    }
    for (const p of data.partners) {
      unionData.get(p.union_id)?.partners.push(p.person_id)
    }
    for (const c of data.childLinks) {
      const tu = unionData.get(c.union_id)
      if (tu) tu.children.push({ child_id: c.child_id, relationship_type: c.relationship_type })
    }
    for (const u of data.unions) {
      for (const pid of unionData.get(u.id)!.partners) {
        const list = unionsOf.get(pid) ?? []
        if (!list.includes(u.id)) {
          list.push(u.id)
          unionsOf.set(pid, list)
        }
      }
    }

    const parentLinks = new Map<string, { parent_id: string; type: RelationshipType }[]>()
    for (const l of data.links) {
      const list = parentLinks.get(l.child_id) ?? []
      list.push({ parent_id: l.parent_id, type: l.relationship_type })
      parentLinks.set(l.child_id, list)
    }

    return {
      rootId,
      people: peopleMap,
      unionsOf,
      unionData,
      expandedUnions,
      expandedParents,
      parentLinks,
    }
  }, [data, rootId, expandedUnions, expandedParents])

  const layout = useMemo<LayoutResult>(() => {
    if (!context) return { nodes: [], edges: [] }
    return buildTreeLayout(context, direction)
  }, [context, direction])

  return { loading, error, reload, layout }
}