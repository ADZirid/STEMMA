// ---------------------------------------------------------------------------
// Carte d'une UNION : partenaires + enfants, avec actions liées.
// ---------------------------------------------------------------------------
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, HeartHandshake, Pencil, Trash2 } from 'lucide-react'
import type { UnionView } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PersonCard } from '@/components/person/PersonCard'
import { RelationshipTypeBadge } from './RelationshipTypeBadge'
import { displayName } from '@/lib/names'
import { compactDate } from '@/lib/dates'
import { unionTypeLabel, unionStatusLabel } from '@/lib/family'
import { useActiveProject } from '@/stores/projectStore'
import { addUnionChild, softDeleteUnion } from '@/database/repositories/unionRepo'
import { PersonPickerDialog } from './PersonPickerDialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

export function UnionCard({
  view,
  people,
  photoOf,
  onChanged,
  onEdit,
}: {
  view: UnionView
  people: { id: string; given_name: string; surname: string }[]
  photoOf?: (personId: string) => string
  onChanged: () => void
  onEdit: () => void
}) {
  const project = useActiveProject()
  const navigate = useNavigate()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { union } = view

  async function pickChild(pid: string) {
    if (!project) return
    await addUnionChild(project.id, union.id, pid)
    toast.success('Enfant ajouté à l’union')
    onChanged()
  }

  async function removeUnion() {
    if (!project) return
    await softDeleteUnion(project.id, union.id)
    toast.success('Union supprimée (récupérable)')
    setConfirmDelete(false)
    onChanged()
  }

  const startLabel = compactDate(view.start)
  const endLabel = compactDate(view.end)
  const period = startLabel || endLabel ? `${startLabel ?? '?'} → ${endLabel ?? ''}` : ''

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <HeartHandshake className="size-4 text-primary" />
        <span className="text-sm font-medium">{unionTypeLabel[union.type]}</span>
        <Badge variant="secondary">{unionStatusLabel[union.status]}</Badge>
        {period && <span className="text-xs text-muted-foreground">{period}</span>}
        {union.place && <span className="text-xs text-muted-foreground">— {union.place}</span>}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            title="Ajouter un enfant"
            onClick={() => setPickerOpen(true)}
          >
            <Plus className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Modifier l'union"
            onClick={onEdit}
          >
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" title="Supprimer l'union" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="p-3">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Partenaires
        </div>
        <div className="flex flex-wrap gap-2">
          {view.partners.map((p) => (
            <PersonCard
              key={p.id}
              person={p}
              photoSrc={photoOf?.(p.id)}
              onClick={() => navigate(`/people/${p.id}`)}
            />
          ))}
        </div>

        <div className="mt-3 mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <Users className="size-3" />
          Enfants ({view.children.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {view.children.map((c) => (
            <div key={c.person.id} className="relative">
              <PersonCard
                person={c.person}
                photoSrc={photoOf?.(c.person.id)}
                onClick={() => navigate(`/people/${c.person.id}`)}
              />
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                <RelationshipTypeBadge type={c.relationship_type} />
              </div>
            </div>
          ))}
          {view.children.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="size-3.5" /> Ajouter un enfant
            </Button>
          )}
        </div>

        {union.notes && (
          <div className="mt-3 text-xs text-muted-foreground">{union.notes}</div>
        )}
      </div>

      <PersonPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        people={people}
        excludeIds={view.partners.map((p) => p.id)}
        title={`Ajouter un enfant à l'union ${displayName(view.partners[0] ?? { given_name: '', surname: '?' })}`}
        onPick={pickChild}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette union ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'union sera placée dans la corbeille (récupérable). Les personnes ne sont pas supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={removeUnion}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}