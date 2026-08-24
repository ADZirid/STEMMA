// ---------------------------------------------------------------------------
// Sélecteur de projet actif (multiple arbres généalogiques).
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderTree, ChevronsUpDown, Check } from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ProjectSwitcher({ collapsed }: { collapsed: boolean }) {
  const { projects, activeId, setActive } = useProjectStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const active = projects.find((p) => p.id === activeId) ?? null

  useEffect(() => {
    if (!projects.length) {
      useProjectStore.getState().load().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (collapsed) {
    return (
      <div className="border-b p-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="w-full"
          title={active?.name ?? 'Projets'}
          onClick={() => navigate('/')}
        >
          <FolderTree className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="border-b p-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex min-w-0 items-center gap-2">
              <FolderTree className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{active?.name ?? 'Aucun projet'}</span>
            </span>
            <ChevronsUpDown className="size-3.5 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Projets d'arbres
          </div>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setActive(p.id)
                setOpen(false)
                navigate('/')
              }}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
                p.id === activeId && 'bg-muted/70',
              )}
            >
              <span className="min-w-0 truncate">{p.name}</span>
              {p.id === activeId && <Check className="size-3.5 shrink-0 text-primary" />}
            </button>
          ))}
          {projects.length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              Aucun projet. Créez-en un depuis l'accueil.
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-1 w-full"
            onClick={() => {
              setOpen(false)
              navigate('/')
            }}
          >
            <Plus className="size-3.5" />
            Nouveau projet
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}