// ---------------------------------------------------------------------------
// Nœud « parents » : petit panneau qui révèle les parents d'une personne.
// ---------------------------------------------------------------------------
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { LayoutNodeData } from '@/features/tree/layout'
import type { Node } from '@xyflow/react'

export type ParentSlotNodeType = Node<LayoutNodeData, 'parentSlot'>

export const ParentSlotNode = memo(function ParentSlotNode(_props: NodeProps<ParentSlotNodeType>) {
  return (
    <div className="relative">
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <div className="flex size-5 items-center justify-center rounded-full border border-dashed bg-muted/40 text-[9px] text-muted-foreground">
        +
      </div>
    </div>
  )
})