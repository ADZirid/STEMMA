// ---------------------------------------------------------------------------
// Nœud « personne » de l'arbre généalogique (React Flow).
// ---------------------------------------------------------------------------
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Plus, Minus, ChevronUp } from 'lucide-react'
import type { LayoutNodeData } from '@/features/tree/layout'
import type { Node } from '@xyflow/react'
import { displayName, initials } from '@/lib/names'
import { compactDate } from '@/lib/dates'
import { cn } from '@/lib/utils'

export type PersonFlowNode = Node<LayoutNodeData, 'person'>

export const PersonNode = memo(function PersonNode({
  data,
  selected,
}: NodeProps<PersonFlowNode>) {
  const person = data.person
  if (!person) {
    return (
      <div className="h-10 w-40 rounded-lg border bg-muted/60" />
    )
  }
  const birth = compactDate(person.birth?.date ?? null)
  const death = compactDate(person.death?.date ?? null)
  const years = birth || death ? `${birth ?? '?'} – ${death ?? '?'}` : null
  const expandable = !!data.expandable
  const isCollapsed = !!data.isCollapsed
  const childCount = Number(data.expandableChildren ?? 0)

  return (
    <div
      onClick={() => data.onOpen?.(person.id)}
      onDoubleClick={() => data.onToggleParents?.(person.id)}
      className={cn(
        'w-40 cursor-pointer rounded-lg border bg-card p-2 text-card-foreground shadow-sm',
        selected && 'ring-2 ring-primary',
        data.isRoot && 'border-primary/60',
      )}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {initials(person)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[12px] font-medium leading-tight">
            {data.isRoot && <span className="mr-1">★</span>}
            {displayName(person)}
          </div>
          {years && <div className="truncate text-[10px] text-muted-foreground">{years}</div>}
        </div>
      </div>
      <div className="flex items-center justify-between pt-1.5">
        <span className="text-[10px] text-muted-foreground">
          {expandable ? `${childCount} enfant${childCount > 1 ? 's' : ''}` : ''}
        </span>
        <div className="flex items-center gap-0.5">
          {isCollapsed && (
            <button
              title="Développer cette branche"
              onClick={(e) => {
                e.stopPropagation()
                data.onExpand?.(person.id)
              }}
              className="flex size-4 items-center justify-center rounded bg-muted hover:bg-muted/70"
            >
              <Plus className="size-3" />
            </button>
          )}
          {expandable && !isCollapsed && (
            <button
              title="Réduire cette branche"
              onClick={(e) => {
                e.stopPropagation()
                data.onCollapse?.(person.id)
              }}
              className="flex size-4 items-center justify-center rounded bg-muted hover:bg-muted/70"
            >
              <Minus className="size-3" />
            </button>
          )}
          <button
            title="Ouvrir la fiche"
            onClick={(e) => {
              e.stopPropagation()
              data.onOpen?.(person.id)
            }}
            className="flex size-4 items-center justify-center rounded hover:bg-muted"
          >
            <ChevronUp className="size-3 -rotate-90" />
          </button>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  )
})