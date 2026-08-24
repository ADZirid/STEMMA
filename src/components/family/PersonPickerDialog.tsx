// ---------------------------------------------------------------------------
// Sélecteur de personne existante (utilisé pour relier enfants / partenaires).
// ---------------------------------------------------------------------------
import { useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { displayName } from '@/lib/names'
import { cn } from '@/lib/utils'

export function PersonPickerDialog({
  open,
  onOpenChange,
  people,
  excludeIds = [],
  title = 'Choisir une personne',
  onPick,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  people: { id: string; given_name: string; surname: string }[]
  excludeIds?: string[]
  title?: string
  onPick: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const filtered = people
    .filter((p) => !excludeIds.includes(p.id))
    .filter((p) => `${p.given_name} ${p.surname}`.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 100)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Sélectionnez parmi les personnes du projet.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Rechercher…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onPick(p.id)
                onOpenChange(false)
              }}
              className={cn(
                'flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
              )}
            >
              {displayName(p)}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              Aucune personne (créez-la d'abord).
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}