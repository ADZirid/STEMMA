// ---------------------------------------------------------------------------
// Nœud d'UNION : petite pastille reliant partenaires et enfants.
// ---------------------------------------------------------------------------
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { LayoutNodeData } from '@/features/tree/layout'
import type { Node } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { unionTypeLabel } from '@/lib/family'

export type UnionFlowNode = Node<LayoutNodeData, 'union'>

export const UnionNode = memo(function UnionNode({ data }: NodeProps<UnionFlowNode>) {
  const childrenCount = data.union?.children.length ?? 0
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div
        className={cn(
          'flex h-6 items-center gap-1 rounded-full border bg-muted px-2 text-[10px] text-muted-foreground',
          childrenCount > 0 && 'ring-1 ring-primary/30',
        )}
      >
        {data.union ? unionTypeLabel[data.union.union.type] : '—'}
        {childrenCount > 0 && <span className="font-mono">({childrenCount})</span>}
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  )
})