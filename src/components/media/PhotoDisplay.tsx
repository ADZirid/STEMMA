// ---------------------------------------------------------------------------
// Affichage de la photo de profil d'une personne avec fallback sur initiales.
// ---------------------------------------------------------------------------
import { useMemo } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { cn } from '@/lib/utils'

interface PhotoDisplayProps {
  photoRelPath: string | null
  givenName: string
  surname: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: 'size-8 text-xs',
  md: 'size-16 text-sm',
  lg: 'size-24 text-lg',
} as const

export function PhotoDisplay({
  photoRelPath,
  givenName,
  surname,
  size = 'md',
  className,
}: PhotoDisplayProps) {
  const initials = useMemo(() => {
    const g = givenName?.trim()?.[0] ?? ''
    const s = surname?.trim()?.[0] ?? ''
    return (g + s).toUpperCase() || '?'
  }, [givenName, surname])

  const sizeClass = SIZES[size]

  if (!photoRelPath) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground',
          sizeClass,
          className,
        )}
      >
        {initials}
      </div>
    )
  }

  // Construire le chemin absolu pour convertFileSrc
  // Le rel_path est du type "media/filename.jpg"
  const absPath = photoRelPath

  return (
    <div className={cn('relative overflow-hidden rounded-full', sizeClass, className)}>
      <img
        src={convertFileSrc(absPath)}
        alt={`Photo de ${givenName} ${surname}`}
        className="size-full object-cover"
        onError={(e) => {
          // Fallback sur initiales si l'image ne charge pas
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
          const parent = target.parentElement
          if (parent) {
            const fallback = document.createElement('div')
            fallback.className = 'flex size-full items-center justify-center bg-muted font-semibold text-muted-foreground'
            fallback.textContent = initials
            parent.appendChild(fallback)
          }
        }}
      />
    </div>
  )
}
