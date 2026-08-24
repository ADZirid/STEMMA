import { Badge } from '@/components/ui/badge'
import type { RelationshipType } from '@/types'
import { relationshipTypeLabel } from '@/lib/family'

export function RelationshipTypeBadge({ type }: { type: RelationshipType }) {
  return (
    <Badge variant="outline" className="text-[10px] font-normal">
      {relationshipTypeLabel[type] ?? type}
    </Badge>
  )
}