// ---------------------------------------------------------------------------
// Canvas de l'arbre (React Flow) : mini-carte, zoom, nœuds personnalisés.
// ---------------------------------------------------------------------------
import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { LayoutResult } from '@/features/tree/layout'
import { PersonNode, type PersonFlowNode } from './PersonNode'
import { UnionNode } from './UnionNode'
import { ParentSlotNode } from './ParentSlotNode'

export interface TreeCanvasProps {
  layout: LayoutResult
  initialCenterId?: string
  expandPerson: (personId: string) => void
  collapsePerson: (personId: string) => void
  openPerson: (personId: string) => void
  toggleParents: (personId: string) => void
}

const nodeTypes: NodeTypes = {
  person: PersonNode,
  union: UnionNode,
  parentSlot: ParentSlotNode,
}

export function TreeCanvas({
  layout,
  expandPerson,
  collapsePerson,
  openPerson,
  toggleParents,
}: TreeCanvasProps) {
  const inject = useCallback(
    (n: LayoutResult['nodes'][number]): Node => {
      const base = { ...n } as Node
      if (n.type === 'person') {
        const pn = base as PersonFlowNode
        pn.data = {
          ...pn.data,
          onExpand: expandPerson,
          onCollapse: collapsePerson,
          onOpen: openPerson,
          onToggleParents: toggleParents,
        }
      }
      return base
    },
    [expandPerson, collapsePerson, openPerson, toggleParents],
  )

  const nodes = useMemo(() => layout.nodes.map(inject), [layout, inject])
  const edges = useMemo<Edge[]>(
    () =>
      layout.edges.map((e) => ({
        ...e,
        type: 'smoothstep',
        style: { strokeWidth: 1.5, stroke: 'var(--border)' },
      })),
    [layout.edges],
  )

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.15}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--border)" />
        <Controls position="bottom-left" />
        <MiniMap
          pannable
          zoomable
          nodeColor={() => 'var(--primary)'}
          maskColor="rgb(0 0 0 / 0.06)"
          className="rounded-lg border"
        />
      </ReactFlow>
    </div>
  )
}