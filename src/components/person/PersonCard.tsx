// ---------------------------------------------------------------------------
// Carte personne moderne : photo, nom, années, indicateurs unions/enfants.
// ---------------------------------------------------------------------------
import { memo } from 'react'
import { Users, HeartHandshake } from 'lucide-react'
import type { PersonDated, DateValue } from '@/types'
import { displayName, initials } from '@/lib/names'
import { compactDate } from '@/lib/dates'
import { cn } from '@/lib/utils'

export interface PersonLike {
  given_name: string
  surname: string
  birth?: { date?: DateValue | null; place?: string } | null
  death?: { date?: DateValue | null; place?: string } | null
}

export interface PersonCardProps {
  person: PersonLike | PersonDated
  photoSrc?: string
  onClick?: () => void
  selected?: boolean
  childrenCount?: number
  unionCount?: number
  className?: string
  muted?: boolean
}

export const PersonCard = memo(function PersonCard({
  person,
  photoSrc,
  onClick,
  selected,
  childrenCount = 0,
  unionCount = 0,
  className,
  muted,
}: PersonCardProps) {
  const birth = compactDate(person.birth?.date ?? null)
  const death = compactDate(person.death?.date ?? null)
  const years = birth || death ? `${birth ?? '?'} – ${death ?? '?'}` : null

  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex w-[164px] flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all',
        selected && 'ring-2 ring-primary',
        !muted && 'hover:shadow-md',
        muted && 'opacity-70',
        className,
      )}
    >
      <div className="flex h-24 items-center justify-center overflow-hidden border-b bg-muted/40">
        {photoSrc ? (
          <img src={photoSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {initials(person)}
          </span>
        )}
      </div>
      <div className="space-y-0.5 p-2">
        <div className="line-clamp-1 text-[13px] font-medium leading-tight">
          {displayName(person)}
        </div>
        {years && (
          <div className="text-xs text-muted-foreground">{years}</div>
        )}
        <div className="flex items-center gap-2 pt-0.5 text-[11px] text-muted-foreground">
          {unionCount > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <HeartHandshake className="size-3" />
              {unionCount} {unionCount === 1 ? 'union' : 'unions'}
            </span>
          )}
          {childrenCount > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Users className="size-3" />
              {childrenCount} {childrenCount === 1 ? 'enfant' : 'enfants'}
            </span>
          )}
        </div>
      </div>
    </button>
  )
})